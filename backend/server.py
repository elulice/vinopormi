from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import re
import json
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Optional, Union
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import math
import bcrypt
import jwt

from recommendations import (
    ProductoTop,
    RecomendacionReponer,
    RecomendacionExceso,
    Recomendaciones,
    calcular as calcular_recomendaciones,
)
from ai_chat import run_chat, warmup_chat_model, transcribe_audio
from ia_metricas import ranking as calcular_ranking, tiempo_trabajado as calcular_tiempo_trabajado

# Zona horaria fija de la app. No usar la TZ del servidor: Render corre en UTC
# y eso desplazaba los rangos de "hoy"/"ayer" 3 horas respecto de Argentina.
TZ_ARGENTINA = ZoneInfo("America/Argentina/Buenos_Aires")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --- Cache en memoria por dominios con invalidacion selectiva ---
# Render Free corre una sola instancia: alcanza con un dict global.
# Cada lectura se guarda con la "version" de los dominios que consume. Solo se
# descarta cuando una escritura modifica REALMENTE uno de esos dominios.
# El TTL es una red de seguridad, no el mecanismo de invalidacion.
import time as _time
import fnmatch
from collections import defaultdict
from functools import wraps

_READ_CACHE = {}
_READ_CACHE_TTL = 3600  # 1 hora; las escrituras invalidan mucho antes
_DOMAIN_VERSION = defaultdict(int)

# Suscriptores del bus de datos (SSE). Cada uno es una Queue con eventos
# {id, domains, stockPatch}. Render Free corre una sola instancia: alcanza.
_DATA_EVENT_SUBSCRIBERS = set()


def publish_data_event(event):
    """Publica un cambio de dominio a todos los clientes conectados por SSE."""
    for queue in tuple(_DATA_EVENT_SUBSCRIBERS):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            pass


def cache_get(key, domains=()):
    entry = _READ_CACHE.get(key)
    if entry is None:
        return None
    expires, value, versions = entry
    if expires <= _time.monotonic():
        _READ_CACHE.pop(key, None)
        return None
    for domain in domains:
        if versions.get(domain, 0) != _DOMAIN_VERSION[domain]:
            _READ_CACHE.pop(key, None)
            return None
    return value


def cache_set(key, value, domains=(), ttl=_READ_CACHE_TTL):
    _READ_CACHE[key] = (
        _time.monotonic() + ttl,
        value,
        {d: _DOMAIN_VERSION[d] for d in domains},
    )
    return value


def invalidate(*domains):
    """Sube la version de los dominios: sus cacheados quedan vagos al instante."""
    for domain in domains:
        _DOMAIN_VERSION[domain] += 1


def patch_cache(patch_fn):
    """Aplica patch_fn a cada valor cacheado vigente, sin invalidar nada."""
    now = _time.monotonic()
    changed = 0
    for key, entry in list(_READ_CACHE.items()):
        expires, value, versions = entry
        if expires <= now:
            _READ_CACHE.pop(key, None)
            continue
        if patch_fn(value):
            changed += 1
    return changed


def _cget(obj, key):
    return obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)


def _cset(obj, key, value):
    if isinstance(obj, dict):
        obj[key] = value
    else:
        setattr(obj, key, value)


def patch_cached_product_stock(stocks):
    """Actualiza SOLO el stock de los productos modificados dentro de las
    respuestas ya cacheadas. Asi una venta no obliga a recalcular Productos.
    `stocks` = {producto_id: stock_nuevo}
    """
    if not stocks:
        return 0

    def patch(value):
        if isinstance(value, list):
            items = value
        elif isinstance(value, dict) and isinstance(value.get('productos'), list):
            items = value['productos']
        elif isinstance(value, dict) and 'id' in value:
            items = [value]
        else:
            return False

        tocado = False
        for p in items:
            pid = _cget(p, 'id')
            if pid in stocks and _cget(p, 'stock') != stocks[pid]:
                _cset(p, 'stock', stocks[pid])
                tocado = True

        # Recalcular el stock de promos usando los productos ya parcheados.
        por_id = {_cget(p, 'id'): p for p in items}
        for p in items:
            if _cget(p, 'tipo') != 'promo' or not _cget(p, 'productos_incluidos'):
                continue
            disponibles = []
            for inc in _cget(p, 'productos_incluidos') or []:
                incluido = por_id.get(_cget(inc, 'producto_id'))
                if incluido is None or _cget(incluido, 'stock') is None:
                    continue
                cantidad = _cget(inc, 'cantidad') or 1
                try:
                    disponibles.append(_cget(incluido, 'stock') // cantidad)
                except TypeError:
                    pass
            nuevo = min(disponibles) if disponibles else 0
            if _cget(p, 'stock') != nuevo:
                _cset(p, 'stock', nuevo)
                tocado = True
        return tocado

    return patch_cache(patch)


def cached(domains=(), prefix="cache", ttl=_READ_CACHE_TTL):
    """Decorador para GETs: clave por usuario + parametros, ligada a la version
    de los dominios indicados. Compatible con la firma que FastAPI inspecciona.
    """
    domains = tuple(domains)

    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            user = kwargs.get('current_user')
            who = getattr(user, 'id', None) or 'anon'
            parts = []
            for name, value in sorted(kwargs.items()):
                if name in ('current_user', 'request', 'response'):
                    continue
                parts.append(f"{name}={value}")
            key = f"{prefix}:{who}:" + "&".join(parts)
            hit = cache_get(key, domains)
            if hit is not None:
                return hit
            value = await fn(*args, **kwargs)
            return cache_set(key, value, domains, ttl=ttl)
        return wrapper
    return decorator


# Mapa de escrituras -> dominios que cambian de verdad. Lo demas sigue en memoria.
_WRITE_INVALIDATIONS = [
    ("POST",   "/auth/register",                    ("usuarios",)),
    ("POST",   "/auth/login",                       ("login_registros", "metricas")),
    # El handler elige dominios finos segun las claves enviadas (ui/tema/auth/
    # dashboard). Este tuple es el fallback y declara los dominios publicados.
    ("PUT",    "/auth/preferencias",                 ("preferencias", "ui", "tema", "auth", "dashboard")),
    ("POST",   "/fix-admin-role",                    ("usuarios",)),
    ("POST",   "/admin/usuarios",                    ("usuarios", "auditoria")),
    ("PUT",    "/admin/usuarios/*",                  ("usuarios", "auditoria")),
    ("DELETE", "/admin/usuarios/*",                  ("usuarios", "auditoria")),
    ("POST",   "/categorias",                        ("categorias", "auditoria")),
    ("PUT",    "/categorias/*",                      ("categorias", "productos", "auditoria")),
    ("DELETE", "/categorias/*",                      ("categorias", "productos", "auditoria")),
    ("POST",   "/productos",                         ("productos", "auditoria")),
    ("PUT",    "/productos/*",                       ("productos", "auditoria")),
    ("DELETE", "/productos/*",                       ("productos", "auditoria")),
    ("POST",   "/presupuestos",                      ("presupuestos", "auditoria")),
    ("PUT",    "/presupuestos/*",                    ("presupuestos", "auditoria")),
    ("DELETE", "/presupuestos/*",                    ("presupuestos", "auditoria")),
    ("POST",   "/clientes",                          ("clientes", "auditoria")),
    ("PUT",    "/clientes/*",                        ("clientes", "auditoria")),
    ("DELETE", "/clientes/*",                        ("clientes", "auditoria")),
    # La venta no invalida Productos: el handler parchea el stock de esos ids.
    ("POST",   "/ventas",                            ("ventas", "dashboard", "movimientos", "clientes", "recomendaciones", "metricas", "mp")),
    ("POST",   "/proveedores",                       ("proveedores", "auditoria")),
    ("PUT",    "/proveedores/*",                     ("proveedores", "auditoria")),
    ("DELETE", "/proveedores/*",                     ("proveedores", "auditoria")),
    ("POST",   "/clientes/*/movimientos",            ("movimientos", "clientes", "dashboard", "metricas")),
    ("POST",   "/proveedores/*/movimientos",         ("movimientos", "proveedores", "dashboard", "metricas")),
    ("POST",   "/egresos",                           ("egresos", "dashboard", "auditoria", "metricas")),
    ("PUT",    "/egresos/*",                         ("egresos", "dashboard", "auditoria", "metricas")),
    ("DELETE", "/egresos/*",                         ("egresos", "dashboard", "auditoria", "metricas")),
    ("POST",   "/sticky-notes",                      ("sticky_notes", "auditoria")),
    ("PUT",    "/sticky-notes/*",                    ("sticky_notes", "auditoria")),
    ("DELETE", "/sticky-notes/*",                    ("sticky_notes", "auditoria")),
    ("POST",   "/sticky-notes/*/comentarios",        ("sticky_notes",)),
    # Cambiar el token de MP solo afecta a MercadoPago: NO toca el dashboard.
    ("POST",   "/mercadopago/configuracion",         ("mp",)),
    ("POST",   "/mercadopago/asociar-transferencia", ("mp", "ventas")),
    ("PUT",    "/novedades",                         ("novedades",)),
    ("DELETE", "/chat/history",                      ("chat",)),
    ("POST",   "/chat",                              ("chat",)),
    ("POST",   "/limpiar-base-datos-direct",         ("ventas", "dashboard", "movimientos", "clientes", "proveedores", "egresos", "productos", "recomendaciones", "metricas", "mp", "auditoria")),
    ("POST",   "/limpiar-base-datos-test",           ("ventas", "dashboard", "movimientos", "clientes", "recomendaciones", "metricas", "mp")),
    ("POST",   "/limpiar-auditoria-direct",          ("auditoria", "metricas")),
    ("POST",   "/limpiar-login-registros-direct",    ("login_registros", "metricas")),
]


# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    root_path="/api",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def cache_invalidation_middleware(request: Request, call_next):
    method = request.method.upper()
    if method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return await call_next(request)

    path = request.url.path
    if path.startswith("/api"):
        path = path[4:]

    dominios = set()
    for patron_metodo, pattern, affected in _WRITE_INVALIDATIONS:
        if patron_metodo == method and fnmatch.fnmatch(path, pattern):
            dominios.update(affected)

    response = await call_next(request)

    # Los handlers pueden afinar los dominios segun el payload (ej. preferencias).
    dominios_override = getattr(request.state, 'data_domains', None)
    if dominios_override:
        dominios = set(dominios_override)

    if dominios and response.status_code < 400:
        invalidate(*dominios)

        # El mismo mapa alimenta el aviso al front. Los eventos viajan en la
        # respuesta HTTP (esta pestaña) y por SSE (demás usuarios/pestañas).
        event_domains = set(dominios)
        stock_patch = getattr(request.state, 'stock_patch', None) or {}
        if stock_patch:
            # Avisamos a Productos, pero NO invalidamos su cache: el stock ya
            # fue parcheado en servidor y el front aplica el mismo parche.
            event_domains.add('productos')

        event = {
            'id': uuid.uuid4().hex,
            'domains': sorted(event_domains),
            'stockPatch': stock_patch,
        }
        response.headers['X-Data-Domains'] = ','.join(event['domains'])
        response.headers['X-Data-Event-Id'] = event['id']
        if stock_patch:
            response.headers['X-Data-Patch'] = json.dumps(
                stock_patch, separators=(',', ':')
            )
        publish_data_event(event)
    return response


api_router = APIRouter()
security = HTTPBearer()


@api_router.get("/ping")
async def ping():
    """Heartbeat público: no toca lastActivity ni necesita token."""
    return {"ok": True}

JWT_SECRET = os.environ.get('JWT_SECRET', 'vinoteca-secret-key-2024')
JWT_ALGORITHM = 'HS256'


def _verify_event_token(token):
    """EventSource no puede enviar headers: el token viaja por query string."""
    if not token:
        return False
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return bool(payload.get('sub'))
    except Exception:
        return False


@api_router.get("/data-events")
async def data_events(request: Request, token: str = Query(default=None)):
    """Canal SSE: avisa a los clientes qué dominios cambiaron."""
    if not _verify_event_token(token):
        raise HTTPException(status_code=401, detail="Token inválido")

    queue = asyncio.Queue(maxsize=32)
    _DATA_EVENT_SUBSCRIBERS.add(queue)

    async def stream():
        try:
            yield ": conectado\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                yield "data: " + json.dumps(event, separators=(',', ':')) + "\n\n"
        finally:
            _DATA_EVENT_SUBSCRIBERS.discard(queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ===== MODELS =====

class Usuario(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    nombre: str
    rol: str = "comun"  # "admin" o "comun"
    preferencias: dict = Field(default_factory=lambda: {"showCents": True, "sidebarWidth": "expanded", "floatingMenu": False, "autoLogout": True, "soloMisDatos": False, "calcularVuelto": True, "darkMode": True, "totalFlotante": False})  # Preferencias del usuario
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lastActivity: Optional[datetime] = None  # Última actividad del usuario

class UsuarioCreate(BaseModel):
    username: str
    password: str
    nombre: str
    rol: str = "comun"  # "admin" o "comun"

class UsuarioUpdate(BaseModel):
    username: Optional[str] = None
    nombre: Optional[str] = None
    password: Optional[str] = None
    rol: Optional[str] = None
    preferencias: Optional[dict] = None

class PreferenciasUpdate(BaseModel):
    showCents: Optional[bool] = None
    sidebarWidth: Optional[str] = None  # 'compact', 'normal', 'expanded'
    floatingMenu: Optional[bool] = None  # Habilitar/deshabilitar menú flotante
    autoLogout: Optional[bool] = None   # Habilitar/deshabilitar cierre de sesión automático
    soloMisDatos: Optional[bool] = None  # Mostrar solo mis datos en dashboard
    calcularVuelto: Optional[bool] = None  # Habilitar/deshabilitar calculadora de vuelto
    darkMode: Optional[bool] = None  # Modo oscuro de la interfaz
    totalFlotante: Optional[bool] = None  # Total fijo/flotante al fondo en nueva venta
    hiddenSidebarItems: Optional[List[str]] = None  # Rutas de elementos del sidebar a ocultar
    hiddenFloatingMenuActions: Optional[List[str]] = None  # IDs de acciones del menú flotante a ocultar

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: Usuario

class ProductoIncluido(BaseModel):
    producto_id: str
    cantidad: int = 1

class Producto(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    precio_unitario: float
    precio_costo: float = 0.0
    stock: int = 0
    tipo: str = "normal"  # "normal" | "promo"
    productos_incluidos: Optional[List[ProductoIncluido]] = None  # solo si es promo
    descuento_cantidad_minima: Optional[int] = None
    descuento_precio_unitario: Optional[float] = None
    is_public: bool = False
    is_featured: bool = False
    image_url: Optional[str] = None
    categoria_id: Optional[str] = None
    categoria_nombre: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductoCreate(BaseModel):
    nombre: str
    precio_unitario: float
    precio_costo: float = 0.0
    stock: Optional[int] = 0
    tipo: str = "normal"
    productos_incluidos: Optional[List[ProductoIncluido]] = None
    descuento_cantidad_minima: Optional[int] = None
    descuento_precio_unitario: Optional[float] = None
    is_public: bool = False
    is_featured: bool = False
    image_url: Optional[str] = None
    categoria_id: Optional[str] = None

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    precio_unitario: Optional[float] = None
    precio_costo: Optional[float] = 0.0
    stock: Optional[int] = None
    tipo: Optional[str] = None
    productos_incluidos: Optional[List[ProductoIncluido]] = None
    descuento_cantidad_minima: Optional[int] = None
    descuento_precio_unitario: Optional[float] = None
    is_public: Optional[bool] = None
    is_featured: Optional[bool] = None
    image_url: Optional[str] = None
    categoria_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Categoria(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoriaCreate(BaseModel):
    nombre: str

class CategoriaUpdate(BaseModel):
    nombre: str

class Cliente(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    apellido: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    puntos: int = 0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClienteCreate(BaseModel):
    nombre: str
    apellido: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None

class DetalleVenta(BaseModel):
    producto_id: str
    producto_nombre: str
    cantidad: int
    precio_unitario: float
    precio_costo_unitario: float = 0.0
    subtotal: float

class Venta(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total: float
    ajuste_monto: float = 0.0
    ajuste_detalle: Optional[str] = None
    ganancia_bruta: float = 0.0
    ganancia_neta: float = 0.0
    medio_pago: str
    cliente_id: Optional[str] = None
    cliente_nombre: Optional[str] = None
    usuario_id: Optional[str] = None
    usuario_nombre: Optional[str] = None
    detalles: List[DetalleVenta]
    pagos: Optional[List[dict]] = None

class PagoVenta(BaseModel):
    medio_pago: str
    monto: float

class VentaCreate(BaseModel):
    pagos: Optional[List[PagoVenta]] = None
    cliente_id: Optional[str] = None
    detalles: List[DetalleVenta]
    ajuste_monto: float = 0.0
    ajuste_detalle: Optional[str] = None

class Proveedor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    cuit: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProveedorCreate(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    cuit: Optional[str] = None

class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    cuit: Optional[str] = None

class MovimientoCuentaCorriente(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cliente_id: Optional[str] = None  # Para compatibilidad con clientes
    proveedor_id: Optional[str] = None  # Nuevo campo para proveedores
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    concepto: str
    monto: float
    venta_id: Optional[str] = None  # ID completo de la venta asociada
    usuario_id: Optional[str] = None  # ID del usuario que creó el movimiento
    usuario_nombre: Optional[str] = None  # Nombre del usuario que creó el movimiento
    saldo_hasta_movimiento: Optional[float] = None  # Saldo acumulado

class DashboardStats(BaseModel):
    total_vendido_hoy: float
    total_vendido_ayer: float = 0
    cantidad_ventas_hoy: int
    ventas_por_medio_pago: dict
    total_saldo_cuenta_corriente: float
    total_egresos_hoy: float
    ingresos_cta_cte_hoy: float = 0
    caja_real: float = 0
    ultimos_clientes_cta_cte: list = []
    ultimas_ventas: list = []

class CuentaCorrienteInfo(BaseModel):
    cliente: Optional[Cliente] = None
    proveedor: Optional[Proveedor] = None
    saldo: float
    movimientos: List[MovimientoCuentaCorriente]

class Notificacion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo: str
    mensaje: str
    productos: Optional[List[dict]] = None
    fecha: datetime
    leida: bool = False

class LoginRegistro(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    usuario_id: str
    usuario_nombre: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RegistroAuditoria(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entidad: str  # 'producto', 'cliente', 'egreso', 'usuario'
    entidad_id: str
    entidad_nombre: Optional[str] = None
    accion: str  # 'creado', 'modificado', 'eliminado'
    valores_anteriores: Optional[dict] = None
    valores_nuevos: Optional[dict] = None
    usuario_id: Optional[str] = None
    usuario_nombre: Optional[str] = None
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None

class Egreso(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    descripcion: str
    monto: float
    categoria: str
    usuario_id: Optional[str] = None
    usuario_nombre: Optional[str] = None

class EgresoCreate(BaseModel):
    descripcion: str
    monto: float
    categoria: str
    usuario_id: Optional[str] = None
    usuario_nombre: Optional[str] = None

class EgresoUpdate(BaseModel):
    descripcion: Optional[str] = None
    monto: Optional[float] = None
    categoria: Optional[str] = None

class StickyNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    texto: str
    autor_id: str  # ID del usuario que creó la nota
    autor_nombre: str  # Nombre del autor
    color: str = "yellow"  # yellow, pink, blue, green
    fijada: bool = False  # Nota fijada (prioritaria)
    editada: bool = False  # Si la nota fue editada
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fecha_actualizacion: Optional[datetime] = None  # Timestamp de última edición
    comentarios: List[dict] = Field(default_factory=list)  # Lista de comentarios

class StickyNoteCreate(BaseModel):
    texto: str
    color: str = "yellow"
    fijada: bool = False

class StickyNoteUpdate(BaseModel):
    texto: Optional[str] = None
    color: Optional[str] = None
    fijada: Optional[bool] = None

class StickyNoteComentario(BaseModel):
    texto: str

class ProductoPublico(BaseModel):
    nombre: str
    precio_unitario: float
    image_url: Optional[str] = None

class ClientePublico(BaseModel):
    nombre: str
    apellido: Optional[str] = None
    puntos: int = 0
    saldo: float = 0

class VentaPublica(BaseModel):
    fecha: datetime
    total: float
    estado: str

class MovimientoPublico(BaseModel):
    fecha: datetime
    concepto: str
    monto: float
    tipo: str  # "pago" or "cargo"

class ProductoCatalogo(BaseModel):
    id: str
    nombre: str
    precio_unitario: float
    image_url: Optional[str] = None
    categoria: Optional[str] = None

# ----- Presupuestos -----
VINOTECA_NOMBRE_DEFAULT = "Vino por Mí"

class PresupuestoItemIn(BaseModel):
    producto_id: str
    cantidad: int = Field(gt=0)

class PresupuestoCreate(BaseModel):
    items: List[PresupuestoItemIn]
    observaciones: str = ""
    vinoteca_nombre: str = VINOTECA_NOMBRE_DEFAULT
    descuento: Optional[Union[str, float]] = None

class PresupuestoUpdate(BaseModel):
    items: Optional[List[PresupuestoItemIn]] = None
    observaciones: Optional[str] = None
    vinoteca_nombre: Optional[str] = None
    descuento: Optional[Union[str, float]] = None
    activo: Optional[bool] = None

class PresupuestoItemGuardado(BaseModel):
    producto_id: str
    nombre: str
    cantidad: int
    # Precio al momento de crear el presupuesto (para detectar cambios)
    precio_unitario: float
    descuento_cantidad_minima: Optional[int] = None
    descuento_precio_unitario: Optional[float] = None

class Presupuesto(BaseModel):
    id: str
    token: str
    activo: bool = True
    vinoteca_nombre: str
    observaciones: str = ""
    items: List[PresupuestoItemGuardado]
    fecha_emision: datetime
    usuario_id: Optional[str] = None
    usuario_nombre: Optional[str] = None
    descuento: str = ""
    descuento_monto: float = 0.0
    total: float = 0.0

class PresupuestoItemPublico(BaseModel):
    producto_id: str
    nombre: str
    cantidad: int
    precio_unitario: float  # vigente (con descuento por cantidad si aplica)
    precio_original: Optional[float] = None  # precio de lista cuando hay descuento
    subtotal: float
    disponible: bool = True
    precio_cambio: bool = False

class PresupuestoPublico(BaseModel):
    vinoteca_nombre: str
    observaciones: str
    fecha_emision: datetime
    items: List[PresupuestoItemPublico]
    descuento_monto: float = 0.0
    total: float
    hay_cambios: bool = False

def precio_unitario_presupuesto(producto: dict, cantidad: int):
    """Devuelve (precio vigente, precio de lista) aplicando descuento por cantidad."""
    precio_lista = float(producto.get('precio_unitario') or 0)
    minimo = producto.get('descuento_cantidad_minima')
    precio_descuento = producto.get('descuento_precio_unitario')
    if (
        minimo is not None
        and precio_descuento is not None
        and cantidad >= int(minimo)
    ):
        return float(precio_descuento), precio_lista
    return precio_lista, None

def monto_descuento_presupuesto(descuento, subtotal: float) -> float:
    """Convierte '1500' en monto o '10%' en porcentaje del subtotal."""
    texto = str(descuento or '').strip().replace(' ', '')
    if not texto:
        return 0.0
    es_porcentaje = texto.endswith('%')
    if es_porcentaje:
        texto = texto[:-1]
    texto = texto.replace(',', '.')
    try:
        valor = float(texto)
    except ValueError:
        return 0.0
    if valor <= 0 or subtotal <= 0:
        return 0.0
    monto = subtotal * valor / 100 if es_porcentaje else valor
    return round(min(max(monto, 0.0), subtotal), 2)


def _fecha_presupuesto(doc: dict) -> datetime:
    fecha = doc.get('timestamp')
    if isinstance(fecha, str):
        try:
            return datetime.fromisoformat(fecha)
        except ValueError:
            return datetime.now(timezone.utc)
    if isinstance(fecha, datetime):
        return fecha
    return datetime.now(timezone.utc)

def _doc_a_presupuesto(doc: dict) -> Presupuesto:
    items = [PresupuestoItemGuardado(**item) for item in (doc.get('items') or [])]
    subtotal = round(sum(
        float(item.precio_unitario) * int(item.cantidad) for item in items
    ), 2)
    descuento = str(doc.get('descuento') or '').strip()
    descuento_monto = monto_descuento_presupuesto(descuento, subtotal)
    total = round(subtotal - descuento_monto, 2)
    return Presupuesto(
        id=doc.get('id', ''),
        token=doc.get('token', ''),
        activo=doc.get('activo', True) is not False,
        vinoteca_nombre=doc.get('vinoteca_nombre') or VINOTECA_NOMBRE_DEFAULT,
        observaciones=doc.get('observaciones') or '',
        items=items,
        fecha_emision=_fecha_presupuesto(doc),
        usuario_id=doc.get('usuario_id'),
        usuario_nombre=doc.get('usuario_nombre'),
        descuento=descuento,
        descuento_monto=descuento_monto,
        total=total,
    )

public_router = APIRouter()

@public_router.get("/public/destacados", response_model=List[ProductoPublico])
@cached(domains=("productos",), prefix="public-destacados")
async def get_productos_destacados():
    # Primero buscar productos destacados
    productos = await db.productos.find(
        {'is_featured': True},
        {'_id': 0, 'nombre': 1, 'precio_unitario': 1, 'image_url': 1}
    ).to_list(20)
    
    # Si no hay destacados, buscar los públicos
    if not productos:
        productos = await db.productos.find(
            {'is_public': True},
            {'_id': 0, 'nombre': 1, 'precio_unitario': 1, 'image_url': 1}
        ).to_list(20)
    
    # Si tampoco hay públicos, traer los últimos 6
    if not productos:
        productos = await db.productos.find(
            {},
            {'_id': 0, 'nombre': 1, 'precio_unitario': 1, 'image_url': 1}
        ).sort('timestamp', -1).limit(6).to_list(6)
    
    return productos

@public_router.get("/public/catalogo", response_model=List[ProductoCatalogo])
@cached(domains=("productos",), prefix="public-catalogo")
async def get_catalogo(
    search: str = None,
    min_price: float = None,
    max_price: float = None
):
    filter_conditions = [
        {'$or': [{'is_featured': True}, {'is_public': True}]}
    ]
    
    # Búsqueda por texto
    if search:
        search_terms = search.split()
        if len(search_terms) > 1:
            # Búsqueda múltiple: todos los términos deben estar en nombre o categoría
            or_conditions = []
            for term in search_terms:
                or_conditions.append({"nombre": {"$regex": term, "$options": "i"}})
                or_conditions.append({"categoria": {"$regex": term, "$options": "i"}})
                or_conditions.append({"categoria_nombre": {"$regex": term, "$options": "i"}})
            filter_conditions.append({"$or": or_conditions})
        else:
            filter_conditions.append({
                "$or": [
                    {"nombre": {"$regex": search, "$options": "i"}},
                    {"categoria": {"$regex": search, "$options": "i"}},
                    {"categoria_nombre": {"$regex": search, "$options": "i"}},
                ]
            })
    
    # Filtro de precio
    if min_price is not None or max_price is not None:
        precio_filter = {}
        if min_price is not None:
            precio_filter["$gte"] = min_price
        if max_price is not None:
            precio_filter["$lte"] = max_price
        filter_conditions.append({"precio_unitario": precio_filter})
    
    filter_query = {"$and": filter_conditions}
    
    productos = await db.productos.find(
        filter_query,
        {'_id': 0, 'id': 1, 'nombre': 1, 'precio_unitario': 1, 'image_url': 1, 'categoria': 1, 'categoria_nombre': 1}
    ).sort('nombre', 1).to_list(500)

    for p in productos:
        if not p.get('categoria') and p.get('categoria_nombre'):
            p['categoria'] = p.get('categoria_nombre')

    return [ProductoCatalogo(**p) for p in productos]

@public_router.get("/public/presupuesto/{token}", response_model=PresupuestoPublico)
@cached(domains=("presupuestos", "productos",), prefix="public-presupuesto-token")
async def get_presupuesto_publico(token: str):
    """Nota pública: recalcula precios vigentes con descuento por cantidad."""
    doc = await db.presupuestos.find_one(
        {'token': token, 'activo': {'$ne': False}},
        {'_id': 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado o revocado")

    items_guardados = doc.get('items') or []
    ids = [item.get('producto_id') for item in items_guardados if item.get('producto_id')]
    productos = await db.productos.find(
        {'id': {'$in': ids}},
        {'_id': 0, 'id': 1, 'nombre': 1, 'precio_unitario': 1,
         'descuento_cantidad_minima': 1, 'descuento_precio_unitario': 1}
    ).to_list(1000)
    por_id = {p.get('id'): p for p in productos}

    items = []
    hay_cambios = False
    for guardado in items_guardados:
        producto_id = guardado.get('producto_id', '')
        cantidad = max(1, int(guardado.get('cantidad') or 1))
        nombre_guardado = guardado.get('nombre') or producto_id
        precio_guardado = float(guardado.get('precio_unitario') or 0)
        producto = por_id.get(producto_id)

        if not producto:
            hay_cambios = True
            items.append(PresupuestoItemPublico(
                producto_id=producto_id,
                nombre=nombre_guardado,
                cantidad=cantidad,
                precio_unitario=0,
                subtotal=0,
                disponible=False,
                precio_cambio=True,
            ))
            continue

        precio, precio_lista = precio_unitario_presupuesto(producto, cantidad)
        cambio = abs(precio - precio_guardado) > 0.001
        if cambio:
            hay_cambios = True
        items.append(PresupuestoItemPublico(
            producto_id=producto_id,
            nombre=producto.get('nombre') or nombre_guardado,
            cantidad=cantidad,
            precio_unitario=precio,
            precio_original=precio_lista,
            subtotal=round(precio * cantidad, 2),
            precio_cambio=cambio,
        ))

    subtotal = round(sum(item.subtotal for item in items), 2)
    descuento_monto = monto_descuento_presupuesto(doc.get('descuento'), subtotal)
    return PresupuestoPublico(
        vinoteca_nombre=doc.get('vinoteca_nombre') or VINOTECA_NOMBRE_DEFAULT,
        observaciones=doc.get('observaciones') or '',
        fecha_emision=_fecha_presupuesto(doc),
        items=items,
        descuento_monto=descuento_monto,
        total=round(subtotal - descuento_monto, 2),
        hay_cambios=hay_cambios,
    )

@public_router.get("/public/cliente/{dni}", response_model=ClientePublico)
@cached(domains=("clientes", "movimientos", "ventas",), prefix="public-cliente-dni")
async def get_cliente_por_dni(dni: str):
    cliente = await db.clientes.find_one({'dni': dni}, {'_id': 0, 'id': 1, 'nombre': 1, 'apellido': 1, 'puntos': 1, 'dni': 1})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Calcular saldo desde movimientos (es la fuente de verdad)
    movimientos = await db.movimientos.find(
        {'cliente_id': cliente.get('id')},
        {'_id': 0, 'monto': 1, 'venta_id': 1}
    ).to_list(1000)
    
    # Obtener IDs de ventas que ya tienen movimiento
    ventas_con_movimiento = {m.get('venta_id') for m in movimientos if m.get('venta_id')}
    
    # Sumar solo movimientos (pagos y abonos)
    saldo = sum(m['monto'] for m in movimientos) if movimientos else 0
    
    # Agregar ventas con CC que NO tienen movimiento (para mantener consistencia)
    ventas_cc = await db.ventas.find(
        {'cliente_id': cliente.get('id'), 'medio_pago': 'cuenta_corriente'},
        {'_id': 0, 'total': 1, 'id': 1}
    ).to_list(1000)
    
    for v in ventas_cc:
        if v.get('id') not in ventas_con_movimiento:
            saldo += v.get('total', 0)
    
    # Verificar si tiene cuenta corriente activa
    tiene_cta_cte = saldo != 0 or len(movimientos) > 0
    
    return ClientePublico(
        nombre=cliente.get('nombre', ''),
        apellido=cliente.get('apellido'),
        puntos=cliente.get('puntos', 0),
        saldo=saldo
    )

@public_router.get("/public/cliente/{dni}/movimientos", response_model=List[MovimientoPublico])
@cached(domains=("clientes", "movimientos", "ventas",), prefix="public-cliente-dni-movimientos")
async def get_movimientos_por_dni(dni: str):
    cliente = await db.clientes.find_one({'dni': dni}, {'_id': 0, 'id': 1})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Obtener TODOS los movimientos de la colección movimientos
    movimientos = await db.movimientos.find(
        {'cliente_id': cliente['id']},
        {'_id': 0, 'fecha': 1, 'concepto': 1, 'monto': 1, 'venta_id': 1}
    ).sort('fecha', -1).to_list(100)
    
    # Obtener ventas con cuenta corriente que NO tienen movimiento asociado
    ventas_cc = await db.ventas.find(
        {'cliente_id': cliente['id'], 'medio_pago': 'cuenta_corriente'},
        {'_id': 0, 'fecha': 1, 'total': 1, 'id': 1}
    ).sort('fecha', -1).to_list(100)
    
    # Crear set de IDs de ventas que ya tienen movimiento
    ventas_con_movimiento = {m.get('venta_id') for m in movimientos if m.get('venta_id')}
    
    resultado = []
    
    # Agregar todos los movimientos
    for m in movimientos:
        fecha = m.get('fecha')
        if isinstance(fecha, str):
            fecha = datetime.fromisoformat(fecha)
        
        resultado.append(MovimientoPublico(
            fecha=fecha,
            concepto=m.get('concepto', 'Movimiento'),
            monto=abs(m.get('monto', 0)),
            tipo='pago' if m.get('monto', 0) > 0 else 'cargo'
        ))
    
    # Agregar ventas con CC que NO tienen movimiento asociado
    for v in ventas_cc:
        if v.get('id') not in ventas_con_movimiento:
            fecha = v.get('fecha')
            if isinstance(fecha, str):
                fecha = datetime.fromisoformat(fecha)
            
            resultado.append(MovimientoPublico(
                fecha=fecha,
                concepto=f"Venta #{v.get('id', '')[:8]}",
                monto=v.get('total', 0),
                tipo='cargo'
            ))
    
    # Ordenar por fecha descendente
    resultado.sort(key=lambda x: x.fecha, reverse=True)
    
    return resultado[:20]  # Últimos 20

@public_router.get("/public/cliente/{dni}/ventas", response_model=List[VentaPublica])
@cached(domains=("clientes", "ventas",), prefix="public-cliente-dni-ventas")
async def get_ventas_por_dni(dni: str):
    cliente = await db.clientes.find_one({'dni': dni}, {'_id': 0, 'id': 1})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    ventas = await db.ventas.find(
        {'cliente_id': cliente['id']},
        {'_id': 0, 'fecha': 1, 'total': 1, 'medio_pago': 1}
    ).sort('fecha', -1).to_list(50)
    
    resultado = []
    for v in ventas:
        estado = 'Pagado'
        if v.get('medio_pago') == 'cuenta_corriente':
            estado = 'Pendiente'
        
        fecha = v.get('fecha')
        if isinstance(fecha, str):
            fecha = datetime.fromisoformat(fecha)
        
        resultado.append(VentaPublica(
            fecha=fecha,
            total=v.get('total', 0),
            estado=estado
        ))
    
    return resultado

# ===== AUDITORÍA HELPER =====

async def registrar_auditoria(
    entidad: str,
    entidad_id: str,
    entidad_nombre: Optional[str] = None,
    accion: Optional[str] = None,
    valores_anteriores: Optional[dict] = None,
    valores_nuevos: Optional[dict] = None,
    usuario_id: Optional[str] = None,
    usuario_nombre: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """Registra una acción de auditoría"""
    registro = RegistroAuditoria(
        entidad=entidad,
        entidad_id=entidad_id,
        entidad_nombre=entidad_nombre,
        accion=accion or 'desconocido',
        valores_anteriores=valores_anteriores,
        valores_nuevos=valores_nuevos,
        usuario_id=usuario_id or '',
        usuario_nombre=usuario_nombre or '',
        ip_address=ip_address
    )
    
    doc = registro.model_dump()
    doc['fecha'] = doc['fecha'].isoformat()
    await db.auditoria.insert_one(doc)

# ===== AUTH HELPERS =====

async def update_last_activity(username: str):
    """Actualiza la última actividad del usuario"""
    await db.usuarios.update_one(
        {'username': username},
        {'$set': {'lastActivity': datetime.now(timezone.utc).isoformat()}}
    )

async def check_auto_logout(user_data: dict) -> bool:
    """Verifica si el usuario debe ser desconectado por inactividad"""
    preferencias = user_data.get('preferencias') or {}
    if not preferencias.get('autoLogout', True):
        return False
    
    last_activity = user_data.get('lastActivity')
    if not last_activity:
        return False
    
    # Convertir a datetime si es string
    if isinstance(last_activity, str):
        last_activity = datetime.fromisoformat(last_activity)
    
    # Asegurar que ambas fechas tengan timezone
    if last_activity.tzinfo is None:
        # Si no tiene timezone, asumir UTC
        last_activity = last_activity.replace(tzinfo=timezone.utc)
    else:
        # Convertir a UTC si tiene otro timezone
        last_activity = last_activity.astimezone(timezone.utc)
    
    # Verificar si han pasado más de 1 hora (3600 segundos)
    time_diff = datetime.now(timezone.utc) - last_activity
    return time_diff.total_seconds() > 3600

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get('sub')
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        user = await db.usuarios.find_one({'username': username}, {'_id': 0, 'password': 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        # Verificar auto logout por inactividad
        if await check_auto_logout(user):
            raise HTTPException(status_code=401, detail="Sesión expirada por inactividad")
        
        # Actualizar última actividad
        await update_last_activity(username)
        
        if isinstance(user.get('timestamp'), str):
            user['timestamp'] = datetime.fromisoformat(user['timestamp'])
        # Un preferencias=None en DB no debe romper la validación del modelo.
        user['preferencias'] = user.get('preferencias') or {"showCents": True}
        
        return Usuario(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def get_admin_user(current_user: Usuario = Depends(get_current_user)):
    if current_user.rol != 'admin':
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return current_user

# ===== AUTH ROUTES =====

@api_router.post("/auth/register", response_model=Usuario)
@limiter.limit("3/minute")  # Máximo 3 registros por minuto
async def register(request: Request, input: UsuarioCreate):
    existing = await db.usuarios.find_one({'username': input.username})
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    hashed_password = bcrypt.hashpw(input.password.encode('utf-8'), bcrypt.gensalt())
    
    usuario_obj = Usuario(username=input.username, nombre=input.nombre, rol='comun')
    doc = usuario_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    doc['password'] = hashed_password.decode('utf-8')
    
    await db.usuarios.insert_one(doc)
    return usuario_obj

@api_router.post("/auth/login", response_model=LoginResponse)
@limiter.limit("5/minute")  # Máximo 5 intentos de login por minuto
async def login(request: Request, input: LoginRequest):
    user = await db.usuarios.find_one({'username': input.username})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    if not bcrypt.checkpw(input.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    token_data = {
        'sub': user['username'],
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    if isinstance(user.get('timestamp'), str):
        user['timestamp'] = datetime.fromisoformat(user['timestamp'])
    
    usuario = Usuario(
        id=user['id'],
        username=user['username'],
        nombre=user['nombre'],
        rol=user.get('rol', 'comun'),  # Incluir el rol, con valor por defecto
        timestamp=user['timestamp'],
        # Sin esto el front arranca con preferencias por defecto aunque el
        # usuario tenga guardado autoLogout=false u otra preferencia.
        preferencias=user.get('preferencias') or {"showCents": True}
    )
    
    # Actualizar última actividad al login
    await db.usuarios.update_one(
        {'id': user['id']},
        {'$set': {'lastActivity': datetime.now(timezone.utc)}}
    )
    
    # Registrar login
    login_registro = LoginRegistro(
        usuario_id=user['id'],
        usuario_nombre=user['nombre'],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get('user-agent')
    )
    
    login_doc = login_registro.model_dump()
    login_doc['fecha'] = login_doc['fecha'].isoformat()
    await db.login_registros.insert_one(login_doc)
    
    return LoginResponse(token=token, user=usuario)

@api_router.get("/auth/me", response_model=Usuario)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user

@api_router.get("/auth/preferencias")
@cached(domains=("preferencias",), prefix="auth-preferencias")
async def get_preferencias(current_user: Usuario = Depends(get_current_user)):
    """Obtener las preferencias del usuario actual"""
    return current_user.preferencias or {'showCents': True}

@api_router.put("/auth/preferencias")
async def update_preferencias(
    request: Request,
    preferencias: PreferenciasUpdate, 
    current_user: Usuario = Depends(get_current_user)
):
    """Actualizar preferencias del usuario actual"""
    # Avisar solo a los dominios que realmente cambiaron.
    cambios = preferencias.model_dump(exclude_unset=True)
    dominios = {'preferencias'}
    if any(clave in cambios for clave in (
        'showCents', 'sidebarWidth', 'floatingMenu', 'calcularVuelto',
        'totalFlotante', 'hiddenSidebarItems', 'hiddenFloatingMenuActions'
    )):
        dominios.add('ui')
    if 'darkMode' in cambios:
        dominios.add('tema')
    if 'autoLogout' in cambios:
        dominios.add('auth')
    if 'soloMisDatos' in cambios:
        dominios.add('dashboard')
    request.state.data_domains = dominios

    # Obtener preferencias actuales
    preferencias_actuales = current_user.preferencias or {'showCents': True}
    
# Actualizar solo los campos proporcionados
    if preferencias.showCents is not None:
        preferencias_actuales['showCents'] = preferencias.showCents
    if preferencias.sidebarWidth is not None:
        preferencias_actuales['sidebarWidth'] = preferencias.sidebarWidth
    if preferencias.floatingMenu is not None:
        preferencias_actuales['floatingMenu'] = preferencias.floatingMenu
    if preferencias.autoLogout is not None:
        preferencias_actuales['autoLogout'] = preferencias.autoLogout
    if preferencias.soloMisDatos is not None:
        preferencias_actuales['soloMisDatos'] = preferencias.soloMisDatos
    if preferencias.calcularVuelto is not None:
        preferencias_actuales['calcularVuelto'] = preferencias.calcularVuelto
    if preferencias.darkMode is not None:
        preferencias_actuales['darkMode'] = preferencias.darkMode
    if preferencias.totalFlotante is not None:
        preferencias_actuales['totalFlotante'] = preferencias.totalFlotante
    if preferencias.hiddenSidebarItems is not None:
        preferencias_actuales['hiddenSidebarItems'] = preferencias.hiddenSidebarItems
    if preferencias.hiddenFloatingMenuActions is not None:
        preferencias_actuales['hiddenFloatingMenuActions'] = preferencias.hiddenFloatingMenuActions

    # Guardar en la base de datos
    await db.usuarios.update_one(
        {'id': current_user.id},
        {'$set': {'preferencias': preferencias_actuales}}
    )

    # modified_count == 0 también ocurre cuando el cliente reenvía las mismas
    # preferencias: eso no es un error, simplemente no hay nada que cambiar.
    return {"message": "Preferencias actualizadas exitosamente", "preferencias": preferencias_actuales}

@api_router.get("/auth/login-registros")
@cached(domains=("login_registros",), prefix="auth-login-registros")
async def get_login_registros(
    current_user: Usuario = Depends(get_current_user),
    page: int = 1,
    limit: int = 50
):
    # Solo administradores pueden ver los registros de login
    if current_user.rol != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos para ver los registros de login")
    
    skip = (page - 1) * limit
    total = await db.login_registros.count_documents({})
    registros = await db.login_registros.find({}, {'_id': 0}).sort('fecha', -1).skip(skip).limit(limit).to_list(limit)
    
    for r in registros:
        if isinstance(r.get('fecha'), str):
            r['fecha'] = datetime.fromisoformat(r['fecha'])
    
    return {
        "data": registros,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }

@api_router.get("/auditoria")
@cached(domains=("auditoria",), prefix="auditoria")
async def get_auditoria(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
    page: int = 1,
    limit: int = 50
):
    # Solo administradores pueden ver la auditoría
    if current_user.rol != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos para ver la auditoría")
    
    # Obtener filtros de query params
    entidad = request.query_params.get('entidad')
    accion = request.query_params.get('accion')
    fechaDesde = request.query_params.get('fechaDesde')
    fechaHasta = request.query_params.get('fechaHasta')
    search = request.query_params.get('search')
    
    # Construir filtro
    filtro = {}
    
    if entidad and entidad != 'todos':
        filtro['entidad'] = entidad
    
    if accion and accion != 'todos':
        # Manejar acciones oldas y nuevas
        if accion == 'creado':
            filtro['accion'] = {'$in': ['creado', 'crear']}
        elif accion == 'modificado':
            filtro['accion'] = {'$in': ['modificado', 'actualizar']}
        elif accion == 'eliminado':
            filtro['accion'] = {'$in': ['eliminado', 'eliminar']}
        else:
            filtro['accion'] = accion
    
    # Filtros de fecha - convertir a ISO con timezone
    if fechaDesde or fechaHasta:
        from datetime import timezone
        ahora_utc = datetime.now(timezone.utc)
        ahora_local = ahora_utc.astimezone(TZ_ARGENTINA)
        
        if fechaDesde:
            # Convertir YYYY-MM-DD a datetime con timezone
            fecha_desde_dt = datetime.strptime(fechaDesde, '%Y-%m-%d').replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            # Si es hora local, convertir a UTC para la comparación
            fecha_desde_local = ahora_local.replace(
                year=fecha_desde_dt.year,
                month=fecha_desde_dt.month,
                day=fecha_desde_dt.day,
                hour=0, minute=0, second=0, microsecond=0
            )
            fecha_desde_utc = fecha_desde_local.astimezone(timezone.utc)
            filtro['fecha'] = {'$gte': fecha_desde_utc.isoformat()}
        
        if fechaHasta:
            # Convertir YYYY-MM-DD a datetime con timezone (fin del día)
            fecha_hasta_dt = datetime.strptime(fechaHasta, '%Y-%m-%d').replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            fecha_hasta_local = ahora_local.replace(
                year=fecha_hasta_dt.year,
                month=fecha_hasta_dt.month,
                day=fecha_hasta_dt.day,
                hour=23, minute=59, second=59, microsecond=999999
            )
            fecha_hasta_utc = fecha_hasta_local.astimezone(timezone.utc)
            if 'fecha' in filtro:
                filtro['fecha']['$lte'] = fecha_hasta_utc.isoformat()
            else:
                filtro['fecha'] = {'$lte': fecha_hasta_utc.isoformat()}
    
    if search:
        filtro['$or'] = [
            {'entidad_nombre': {'$regex': search, '$options': 'i'}},
            {'entidad_id': {'$regex': search, '$options': 'i'}},
            {'valores_nuevos.nombre': {'$regex': search, '$options': 'i'}},
            {'valores_nuevos.username': {'$regex': search, '$options': 'i'}}
        ]
    
    # Obtener registros sin filtro de fecha
    skip = (page - 1) * limit
    total = await db.auditoria.count_documents(filtro)
    registros = await db.auditoria.find(filtro, {'_id': 0}).sort('fecha', -1).skip(skip).limit(limit).to_list(limit)
    
    # Procesar registros para limpiar ObjectIds
    for registro in registros:
        # Convertir ObjectIds anidados a strings
        if 'valores_anteriores' in registro and isinstance(registro['valores_anteriores'], dict):
            for key, value in registro['valores_anteriores'].items():
                if hasattr(value, '__str__') and 'ObjectId' in str(type(value)):
                    registro['valores_anteriores'][key] = str(value)
        
        if 'valores_nuevos' in registro and isinstance(registro['valores_nuevos'], dict):
            for key, value in registro['valores_nuevos'].items():
                if hasattr(value, '__str__') and 'ObjectId' in str(type(value)):
                    registro['valores_nuevos'][key] = str(value)
        
        # Convertir fechas string a datetime
        if isinstance(registro.get('fecha'), str):
            registro['fecha'] = datetime.fromisoformat(registro['fecha'])
    
    return {
        "data": registros,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }

# ===== CATEGORIAS ROUTES =====

@api_router.get("/categorias", response_model=List[Categoria])
@cached(domains=("categorias",), prefix="categorias")
async def get_categorias(current_user: Usuario = Depends(get_current_user)):
    categorias = await db.categorias.find({}, {"_id": 0}).sort("nombre", 1).to_list(1000)
    for c in categorias:
        if isinstance(c.get("fecha_creacion"), str):
            try:
                c["fecha_creacion"] = datetime.fromisoformat(c["fecha_creacion"])
            except Exception:
                c["fecha_creacion"] = datetime.now(timezone.utc)
    return categorias


@api_router.post("/categorias", response_model=Categoria)
async def create_categoria(
    request: Request,
    input: CategoriaCreate,
    current_user: Usuario = Depends(get_current_user),
):
    nombre = (input.nombre or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre de la categoría es obligatorio")

    # Unicidad case-insensitive
    existing = await db.categorias.find_one(
        {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}},
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe la categoría '{existing.get('nombre', nombre)}'")

    categoria_obj = Categoria(nombre=nombre)
    doc = categoria_obj.model_dump()
    doc["fecha_creacion"] = doc["fecha_creacion"].isoformat()
    await db.categorias.insert_one(doc)

    await registrar_auditoria(
        entidad='categoria',
        entidad_id=categoria_obj.id,
        entidad_nombre=nombre,
        accion='creado',
        valores_nuevos={'nombre': nombre},
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    return categoria_obj


@api_router.put("/categorias/{categoria_id}", response_model=Categoria)
async def update_categoria(
    request: Request,
    categoria_id: str,
    input: CategoriaUpdate,
    current_user: Usuario = Depends(get_current_user),
):
    categoria = await db.categorias.find_one({"id": categoria_id}, {"_id": 0})
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    nombre = (input.nombre or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre de la categoría es obligatorio")

    existing = await db.categorias.find_one(
        {
            "id": {"$ne": categoria_id},
            "nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"},
        },
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe la categoría '{existing.get('nombre', nombre)}'")

    nombre_anterior = categoria.get('nombre')
    await db.categorias.update_one({"id": categoria_id}, {"$set": {"nombre": nombre}})
    productos_actualizados = await db.productos.update_many(
        {"categoria_id": categoria_id}, {"$set": {"categoria_nombre": nombre}}
    )

    await registrar_auditoria(
        entidad='categoria',
        entidad_id=categoria_id,
        entidad_nombre=nombre,
        accion='modificado',
        valores_anteriores={'nombre': nombre_anterior},
        valores_nuevos={'nombre': nombre, 'productos_actualizados': productos_actualizados.modified_count},
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )

    categoria["nombre"] = nombre
    if isinstance(categoria.get("fecha_creacion"), str):
        try:
            categoria["fecha_creacion"] = datetime.fromisoformat(categoria["fecha_creacion"])
        except Exception:
            categoria["fecha_creacion"] = datetime.now(timezone.utc)
    elif not categoria.get("fecha_creacion"):
        categoria["fecha_creacion"] = datetime.now(timezone.utc)
    return Categoria(**categoria)


@api_router.delete("/categorias/{categoria_id}")
async def delete_categoria(
    request: Request,
    categoria_id: str,
    current_user: Usuario = Depends(get_current_user),
):
    categoria = await db.categorias.find_one({"id": categoria_id}, {"_id": 0})
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    # Opción A: bloquear si está en uso
    en_uso = await db.productos.count_documents({"categoria_id": categoria_id})
    if en_uso > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar la categoría porque está asociada a {en_uso} producto(s). Reasignalos o quitá la categoría antes de eliminarla.",
        )

    await registrar_auditoria(
        entidad='categoria',
        entidad_id=categoria_id,
        entidad_nombre=categoria.get('nombre'),
        accion='eliminado',
        valores_anteriores=categoria,
        valores_nuevos=None,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    await db.categorias.delete_one({"id": categoria_id})
    return {"message": "Categoría eliminada"}


# ===== PRODUCTOS ROUTES =====

@api_router.post("/productos", response_model=Producto)
async def create_producto(
    request: Request,
    input: ProductoCreate, 
    current_user: Usuario = Depends(get_current_user)
):
    # Verificar si ya existe un producto con el mismo nombre
    existing = await db.productos.find_one({"nombre": input.nombre})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Ya existe un producto con el nombre '{input.nombre}'"
        )
    
    # Asegurar que precio_costo esté presente y resolver categoría
    producto_data = input.model_dump()
    if 'precio_costo' not in producto_data or producto_data['precio_costo'] is None:
        producto_data['precio_costo'] = 0.0

    categoria_id = producto_data.get('categoria_id')
    if categoria_id:
        categoria = await db.categorias.find_one({"id": categoria_id}, {"_id": 0})
        if not categoria:
            raise HTTPException(status_code=400, detail="La categoría seleccionada no existe")
        producto_data['categoria_id'] = categoria_id
        producto_data['categoria_nombre'] = categoria.get('nombre')
    else:
        producto_data['categoria_id'] = None
        producto_data['categoria_nombre'] = None

    producto_obj = Producto(**producto_data)
    doc = producto_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.productos.insert_one(doc)
    
    # Registrar auditoría
    await registrar_auditoria(
        entidad='producto',
        entidad_id=producto_obj.id,
        entidad_nombre=producto_obj.nombre,
        accion='creado',
        valores_nuevos=input.model_dump(),
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    return producto_obj

@api_router.get("/productos", response_model=List[Producto])
async def get_productos(current_user: Usuario = Depends(get_current_user)):
    # Endpoint legacy para compatibilidad - usa paginación por defecto
    return await get_productos_paginated(current_user, page=1, limit=100)

@api_router.get("/productos-paginados")
@cached(domains=("productos",), prefix="productos-paginados")
async def get_productos_paginated(
    current_user: Usuario = Depends(get_current_user),
    page: int = 1,
    limit: int = 50,
    search: str = None,
    tipo: str = None,
    is_public: str = None,
    is_featured: str = None,
    has_discount: str = None
):
    """Endpoint optimizado con paginación, búsqueda y filtros"""
    try:
        skip = (page - 1) * limit
        filter_query = {}
        
        # Búsqueda por nombre
        if search:
            search_terms = search.split()
            if len(search_terms) > 1:
                regex_patterns = [{"nombre": {"$regex": term, "$options": "i"}} for term in search_terms]
                filter_query["$and"] = regex_patterns
            else:
                filter_query["nombre"] = {"$regex": search, "$options": "i"}
        
        # Construir filter condiciones en un $and para evitar conflictos
        filter_conditions = []
        
        # Filtro por tipo (incluye productos sin tipo definido como "normal")
        if tipo == "normal":
            filter_conditions.append({
                "$or": [{"tipo": "normal"}, {"tipo": {"$exists": False}}, {"tipo": None}]
            })
        elif tipo == "promo":
            filter_conditions.append({"tipo": "promo"})
        
        # Filtro por is_public
        if is_public == "true":
            filter_conditions.append({"is_public": True})
        elif is_public == "false":
            filter_conditions.append({"is_public": {"$ne": True}})
        
        # Filtro por is_featured
        if is_featured == "true":
            filter_conditions.append({"is_featured": True})
        elif is_featured == "false":
            filter_conditions.append({"is_featured": {"$ne": True}})
        
        # Filtro por descuento
        if has_discount == "true":
            filter_conditions.append({
                "descuento_cantidad_minima": {"$exists": True, "$ne": None},
                "descuento_precio_unitario": {"$exists": True, "$ne": None}
            })
        elif has_discount == "false":
            filter_conditions.append({
                "$or": [
                    {"descuento_cantidad_minima": {"$exists": False}},
                    {"descuento_cantidad_minima": None},
                    {"descuento_precio_unitario": {"$exists": False}},
                    {"descuento_precio_unitario": None}
                ]
            })
        
        # Aplicar todas las condiciones con $and
        if filter_conditions:
            filter_query["$and"] = filter_conditions
        
        # Query con paginación
        cursor = db.productos.find(
            filter_query, 
            {'_id': 0}
        ).sort('nombre', 1).skip(skip).limit(limit)
        
        productos = await cursor.to_list(limit)
        
        # Convertir timestamps
        for p in productos:
            if isinstance(p.get('timestamp'), str):
                p['timestamp'] = datetime.fromisoformat(p['timestamp'])
        
        # Obtener total para metadatos de paginación
        total = await db.productos.count_documents(filter_query)
        
        return {
            "productos": productos,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit,
                "has_next": page * limit < total,
                "has_prev": page > 1
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener productos: {str(e)}")

@api_router.get("/productos/{producto_id}", response_model=Producto)
@cached(domains=("productos",), prefix="productos-producto_id")
async def get_producto(producto_id: str, current_user: Usuario = Depends(get_current_user)):
    producto = await db.productos.find_one({'id': producto_id}, {'_id': 0})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if isinstance(producto.get('timestamp'), str):
        producto['timestamp'] = datetime.fromisoformat(producto['timestamp'])
    
    return Producto(**producto)

# ----- Presupuestos (autenticados) -----

async def _build_items_presupuesto(items: List[PresupuestoItemIn]) -> List[dict]:
    if not items:
        raise HTTPException(status_code=400, detail="El presupuesto debe tener al menos un producto")

    ids = []
    for item in items:
        if item.producto_id in ids:
            raise HTTPException(status_code=400, detail="No se puede repetir un producto en el presupuesto")
        ids.append(item.producto_id)

    productos = await db.productos.find(
        {'id': {'$in': ids}},
        {'_id': 0, 'id': 1, 'nombre': 1, 'precio_unitario': 1,
         'descuento_cantidad_minima': 1, 'descuento_precio_unitario': 1}
    ).to_list(1000)
    por_id = {p.get('id'): p for p in productos}

    faltantes = [item.producto_id for item in items if item.producto_id not in por_id]
    if faltantes:
        raise HTTPException(status_code=404, detail=f"Productos no encontrados: {', '.join(faltantes)}")

    guardados = []
    for item in items:
        producto = por_id[item.producto_id]
        precio, _ = precio_unitario_presupuesto(producto, item.cantidad)
        guardados.append({
            'producto_id': item.producto_id,
            'nombre': producto.get('nombre') or item.producto_id,
            'cantidad': item.cantidad,
            'precio_unitario': precio,
            'descuento_cantidad_minima': producto.get('descuento_cantidad_minima'),
            'descuento_precio_unitario': producto.get('descuento_precio_unitario'),
        })
    return guardados

@api_router.post("/presupuestos", response_model=Presupuesto)
async def create_presupuesto(
    request: Request,
    input: PresupuestoCreate,
    current_user: Usuario = Depends(get_current_user)
):
    items = await _build_items_presupuesto(input.items)
    doc = {
        'id': str(uuid.uuid4()),
        'token': secrets.token_urlsafe(24),
        'activo': True,
        'usuario_id': current_user.id,
        'usuario_nombre': current_user.nombre,
        'vinoteca_nombre': (input.vinoteca_nombre or '').strip() or VINOTECA_NOMBRE_DEFAULT,
        'observaciones': (input.observaciones or '').strip(),
        'descuento': str(input.descuento or '').strip(),
        'items': items,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }
    await db.presupuestos.insert_one(doc)

    # Registrar auditoría (el link público no pide sesión, pero su alta sí).
    await registrar_auditoria(
        entidad='presupuesto',
        entidad_id=doc['id'],
        entidad_nombre=doc['vinoteca_nombre'],
        accion='creado',
        valores_nuevos={
            'vinoteca_nombre': doc['vinoteca_nombre'],
            'observaciones': doc['observaciones'],
            'descuento': doc['descuento'],
            'items': doc['items'],
        },
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    return _doc_a_presupuesto(doc)

@api_router.get("/presupuestos", response_model=List[Presupuesto])
@cached(domains=("presupuestos",), prefix="presupuestos")
async def list_presupuestos(current_user: Usuario = Depends(get_current_user)):
    # Presupuestos es una sección compartida: cualquier usuario ve todos los guardados.
    docs = await db.presupuestos.find({}, {'_id': 0}).sort('timestamp', -1).to_list(200)

    # Los presupuestos viejos no guardaban el nombre del creador.
    ids_faltantes = list({
        doc.get('usuario_id') for doc in docs
        if doc.get('usuario_id') and not doc.get('usuario_nombre')
    })
    nombres = {}
    if ids_faltantes:
        usuarios = await db.usuarios.find(
            {'id': {'$in': ids_faltantes}}, {'_id': 0, 'id': 1, 'nombre': 1}
        ).to_list(1000)
        nombres = {u.get('id'): u.get('nombre') for u in usuarios}
        for doc in docs:
            if not doc.get('usuario_nombre'):
                doc['usuario_nombre'] = nombres.get(doc.get('usuario_id'))

    return [_doc_a_presupuesto(doc) for doc in docs]

@api_router.get("/presupuestos/{presupuesto_id}", response_model=Presupuesto)
@cached(domains=("presupuestos",), prefix="presupuestos-presupuesto_id")
async def get_presupuesto(
    presupuesto_id: str,
    current_user: Usuario = Depends(get_current_user)
):
    doc = await db.presupuestos.find_one({'id': presupuesto_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return _doc_a_presupuesto(doc)

@api_router.put("/presupuestos/{presupuesto_id}", response_model=Presupuesto)
async def update_presupuesto(
    request: Request,
    presupuesto_id: str,
    input: PresupuestoUpdate,
    current_user: Usuario = Depends(get_current_user)
):
    doc = await db.presupuestos.find_one({'id': presupuesto_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    campos_auditados = ('activo', 'vinoteca_nombre', 'observaciones', 'descuento', 'items')
    valores_anteriores = {campo: doc.get(campo) for campo in campos_auditados}
    estado_anterior = doc.get('activo')

    cambios = {}
    if input.items is not None:
        cambios['items'] = await _build_items_presupuesto(input.items)
    if input.observaciones is not None:
        cambios['observaciones'] = input.observaciones.strip()
    if input.vinoteca_nombre is not None:
        cambios['vinoteca_nombre'] = input.vinoteca_nombre.strip() or VINOTECA_NOMBRE_DEFAULT
    if input.descuento is not None:
        cambios['descuento'] = str(input.descuento).strip()
    if input.activo is not None:
        cambios['activo'] = input.activo
    if 'items' in cambios:
        cambios['timestamp'] = datetime.now(timezone.utc).isoformat()

    if cambios:
        await db.presupuestos.update_one({'id': presupuesto_id}, {'$set': cambios})
        doc.update(cambios)

        # Revocar el enlace público se registra como una acción propia.
        accion = 'modificado'
        if cambios.get('activo') is False and estado_anterior is not False:
            accion = 'revocado'
        valores_nuevos = {campo: doc.get(campo) for campo in campos_auditados if campo in cambios}
        await registrar_auditoria(
            entidad='presupuesto',
            entidad_id=presupuesto_id,
            entidad_nombre=doc.get('vinoteca_nombre'),
            accion=accion,
            valores_anteriores={campo: valores_anteriores[campo] for campo in valores_nuevos},
            valores_nuevos=valores_nuevos,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre,
            ip_address=request.client.host if request.client else None
        )
    return _doc_a_presupuesto(doc)

@api_router.delete("/presupuestos/{presupuesto_id}")
async def eliminar_presupuesto(
    request: Request,
    presupuesto_id: str,
    current_user: Usuario = Depends(get_current_user)
):
    doc = await db.presupuestos.find_one({'id': presupuesto_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    await registrar_auditoria(
        entidad='presupuesto',
        entidad_id=presupuesto_id,
        entidad_nombre=doc.get('vinoteca_nombre'),
        accion='eliminado',
        valores_anteriores=doc,
        valores_nuevos=None,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    await db.presupuestos.delete_one({'id': presupuesto_id})
    return {"success": True, "message": "Presupuesto eliminado"}

@api_router.put("/productos/{producto_id}", response_model=Producto)
async def update_producto(
    request: Request,
    producto_id: str, 
    input: ProductoUpdate, 
    current_user: Usuario = Depends(get_current_user)
):
    producto = await db.productos.find_one({'id': producto_id}, {'_id': 0})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Guardar valores anteriores de todos los campos auditables, no sólo los
    # históricos, para que el modal pueda comparar antes/después de cada cambio.
    campos_auditados = (
        'nombre', 'precio_unitario', 'precio_costo', 'stock', 'tipo',
        'descuento_cantidad_minima', 'descuento_precio_unitario',
        'is_public', 'is_featured', 'categoria_id', 'categoria_nombre'
    )
    valores_anteriores = {campo: producto.get(campo) for campo in campos_auditados}
    
    # Obtener todos los datos del input excepto los que son None
    input_data = input.model_dump()
    update_data = {k: v for k, v in input_data.items() if v is not None}

    # Forzar precio_costo si viene en el payload (inclusive si es 0)
    if 'precio_costo' in input_data:
        update_data['precio_costo'] = input_data['precio_costo']

    # Manejo de categoría (permitir asignar o limpiar si se envía explícitamente)
    fields_set = getattr(input, "model_fields_set", set())
    if 'categoria_id' in fields_set or 'categoria_id' in input_data:
        raw_cat = input_data.get('categoria_id', None)
        if raw_cat:
            categoria = await db.categorias.find_one({"id": raw_cat}, {"_id": 0})
            if not categoria:
                raise HTTPException(status_code=400, detail="La categoría seleccionada no existe")
            update_data['categoria_id'] = raw_cat
            update_data['categoria_nombre'] = categoria.get('nombre')
        else:
            update_data['categoria_id'] = None
            update_data['categoria_nombre'] = None


    if update_data:
        await db.productos.update_one({'id': producto_id}, {'$set': update_data})
        
        # Registrar auditoría
        await registrar_auditoria(
            entidad='producto',
            entidad_id=producto_id,
            entidad_nombre=producto.get('nombre'),
            accion='modificado',
            valores_anteriores=valores_anteriores,
            valores_nuevos=update_data,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre,
            ip_address=request.client.host if request.client else None
        )
    
    updated_producto = await db.productos.find_one({'id': producto_id}, {'_id': 0})
    if not updated_producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if isinstance(updated_producto.get('timestamp'), str):
        updated_producto['timestamp'] = datetime.fromisoformat(updated_producto['timestamp'])
    
    return Producto(**updated_producto)

@api_router.delete("/productos/{producto_id}")
async def delete_producto(
    request: Request,
    producto_id: str, 
    current_user: Usuario = Depends(get_current_user)
):
    # Obtener producto antes de eliminar para auditoría
    producto = await db.productos.find_one({'id': producto_id}, {'_id': 0})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Registrar auditoría antes de eliminar
    await registrar_auditoria(
        entidad='producto',
        entidad_id=producto_id,
        entidad_nombre=producto.get('nombre'),
        accion='eliminado',
        valores_anteriores=producto,
        valores_nuevos=None,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    result = await db.productos.delete_one({'id': producto_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    return {"message": "Producto eliminado"}

@api_router.get("/productos-stock")
@cached(domains=("productos",), prefix="productos-stock")
async def get_productos_con_stock(current_user: Usuario = Depends(get_current_user)):
    """Obtiene todos los productos con stock calculado para promos"""
    productos = await db.productos.find({}, {'_id': 0}).to_list(1000)
    
    for p in productos:
        if isinstance(p.get('timestamp'), str):
            p['timestamp'] = datetime.fromisoformat(p['timestamp'])
        
        if p.get('tipo') == 'promo' and p.get('productos_incluidos'):
            stocks = []
            for incluido in p['productos_incluidos']:
                prod = await db.productos.find_one({'id': incluido['producto_id']}, {'_id': 0, 'stock': 1})
                if prod:
                    stock_disponible = prod.get('stock', 0) // incluido['cantidad']
                    stocks.append(stock_disponible)
            p['stock'] = min(stocks) if stocks else 0
    
    return productos

# ===== CLIENTES ROUTES =====

@api_router.post("/clientes", response_model=Cliente)
async def create_cliente(
    request: Request,
    input: ClienteCreate, 
    current_user: Usuario = Depends(get_current_user)
):
    if input.dni:
        existing = await db.clientes.find_one({"dni": input.dni})
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Ya existe un cliente con el DNI '{input.dni}'"
            )
    
    cliente_obj = Cliente(
        **input.model_dump(),
        puntos=0
    )
    doc = cliente_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.clientes.insert_one(doc)
    
    # Registrar auditoría
    await registrar_auditoria(
        entidad='cliente',
        entidad_id=cliente_obj.id,
        entidad_nombre=cliente_obj.nombre,
        accion='creado',
        valores_nuevos=input.model_dump(),
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    return cliente_obj

@api_router.get("/clientes", response_model=List[dict])
@cached(domains=("clientes", "movimientos",), prefix="clientes")
async def get_clientes(current_user: Usuario = Depends(get_current_user)):
    clientes = await db.clientes.find({}, {'_id': 0}).to_list(1000)
    
    for c in clientes:
        if isinstance(c.get('timestamp'), str):
            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
        
        # Calcular saldo para cada cliente
        movimientos = await db.movimientos.find({'cliente_id': c['id']}, {'_id': 0}).to_list(1000)
        saldo = sum(m['monto'] for m in movimientos)
        c['saldo'] = saldo
    
    return clientes

@api_router.get("/clientes/{cliente_id}", response_model=Cliente)
@cached(domains=("clientes",), prefix="clientes-cliente_id")
async def get_cliente(cliente_id: str, current_user: Usuario = Depends(get_current_user)):
    cliente = await db.clientes.find_one({'id': cliente_id}, {'_id': 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    if isinstance(cliente.get('timestamp'), str):
        cliente['timestamp'] = datetime.fromisoformat(cliente['timestamp'])
    
    return Cliente(**cliente)

@api_router.put("/clientes/{cliente_id}", response_model=Cliente)
async def update_cliente(
    request: Request,
    cliente_id: str, 
    input: ClienteUpdate, 
    current_user: Usuario = Depends(get_current_user)
):
    cliente = await db.clientes.find_one({'id': cliente_id}, {'_id': 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Validar DNI duplicado
    if input.dni and input.dni != cliente.get('dni'):
        existing = await db.clientes.find_one({"dni": input.dni, "id": {"$ne": cliente_id}})
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Ya existe otro cliente con el DNI '{input.dni}'"
            )
    
    # Guardar valores anteriores
    valores_anteriores = {
        'nombre': cliente.get('nombre'),
        'apellido': cliente.get('apellido'),
        'dni': cliente.get('dni'),
        'telefono': cliente.get('telefono'),
        'email': cliente.get('email')
    }
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.clientes.update_one({'id': cliente_id}, {'$set': update_data})
        
        # Registrar auditoría
        await registrar_auditoria(
            entidad='cliente',
            entidad_id=cliente_id,
            entidad_nombre=cliente.get('nombre'),
            accion='modificado',
            valores_anteriores=valores_anteriores,
            valores_nuevos=update_data,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre,
            ip_address=request.client.host if request.client else None
        )
    
    updated_cliente = await db.clientes.find_one({'id': cliente_id}, {'_id': 0})
    if not updated_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    if isinstance(updated_cliente.get('timestamp'), str):
        updated_cliente['timestamp'] = datetime.fromisoformat(updated_cliente['timestamp'])
    
    return Cliente(**updated_cliente)

@api_router.delete("/clientes/{cliente_id}")
async def delete_cliente(
    request: Request,
    cliente_id: str, 
    current_user: Usuario = Depends(get_current_user)
):
    # Obtener cliente antes de eliminar para auditoría
    cliente = await db.clientes.find_one({'id': cliente_id}, {'_id': 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Registrar auditoría antes de eliminar
    await registrar_auditoria(
        entidad='cliente',
        entidad_id=cliente_id,
        entidad_nombre=cliente.get('nombre'),
        accion='eliminado',
        valores_anteriores=cliente,
        valores_nuevos=None,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    result = await db.clientes.delete_one({'id': cliente_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    return {"message": "Cliente eliminado"}

# ===== VENTAS ROUTES =====

@api_router.post("/ventas", response_model=Venta)
async def create_venta(request: Request, input: VentaCreate, current_user: Usuario = Depends(get_current_user)):
    # Unificar detalles por producto_id y buscar precio_costo
    detalles_unificados = {}
    for detalle in input.detalles:
        # Buscar precio_costo del producto
        producto = await db.productos.find_one({'id': detalle.producto_id}, {'precio_costo': 1, 'tipo': 1, 'productos_incluidos': 1})
        precio_costo = 0.0
        
        if producto:
            if producto.get('tipo') == 'promo' and producto.get('productos_incluidos'):
                # Para promociones, calcular el costo basado en los productos incluidos
                costo_promo = 0.0
                for incluido in producto['productos_incluidos']:
                    prod_incluido = await db.productos.find_one({'id': incluido['producto_id']}, {'precio_costo': 1})
                    if prod_incluido:
                        costo_promo += (prod_incluido.get('precio_costo', 0) or 0) * incluido.get('cantidad', 1)
                precio_costo = costo_promo
            else:
                precio_costo = producto.get('precio_costo', 0) or 0
        
        if detalle.producto_id in detalles_unificados:
            detalles_unificados[detalle.producto_id]['cantidad'] += detalle.cantidad
            detalles_unificados[detalle.producto_id]['subtotal'] += detalle.subtotal
            detalles_unificados[detalle.producto_id]['precio_costo_unitario'] = precio_costo
            detalles_unificados[detalle.producto_id]['costo_total'] += precio_costo * detalle.cantidad
        else:
            detalles_unificados[detalle.producto_id] = {
                'producto_id': detalle.producto_id,
                'producto_nombre': detalle.producto_nombre,
                'cantidad': detalle.cantidad,
                'precio_unitario': detalle.precio_unitario,
                'precio_costo_unitario': precio_costo,
                'costo_total': precio_costo * detalle.cantidad,
                'subtotal': detalle.subtotal
            }
    
    detalles_finales = list(detalles_unificados.values())
    subtotal_productos = sum(d['subtotal'] for d in detalles_finales)
    ajuste_monto = input.ajuste_monto or 0.0
    total = subtotal_productos + ajuste_monto
    total_costos = sum(d.get('costo_total', 0) for d in detalles_finales)
    ganancia_bruta = total
    ganancia_neta = total - total_costos
    
    # Determinar medio_pago y pagos
    if input.pagos and len(input.pagos) > 0:
        # Usar el primer pago como medio_pago principal para compatibilidad
        medio_pago = input.pagos[0].medio_pago
        # Verificar si hay cuenta corriente en los pagos
        tiene_cuenta_corriente = any(p.medio_pago == 'cuenta_corriente' for p in input.pagos)
        # Sumar los montos de todos los pagos
        total_pagos = sum(p.monto for p in input.pagos)
    else:
        # Fallback para compatibilidad hacia atrás
        medio_pago = 'efectivo'
        tiene_cuenta_corriente = False
        total_pagos = total
    
    cliente_nombre = None
    if input.cliente_id:
        cliente = await db.clientes.find_one({'id': input.cliente_id}, {'_id': 0})
        if cliente:
            cliente_nombre = cliente['nombre']
    
    # Guardar los pagos en la venta
    pagos_guardar = None
    if input.pagos:
        pagos_guardar = [{"medio_pago": p.medio_pago, "monto": p.monto} for p in input.pagos]
    
    # Limpiar detalles_finales para crear DetalleVenta (quitar campos temporales)
    detalles_para_guardar = []
    for d in detalles_finales:
        detalles_para_guardar.append({
            'producto_id': d['producto_id'],
            'producto_nombre': d['producto_nombre'],
            'cantidad': d['cantidad'],
            'precio_unitario': d['precio_unitario'],
            'precio_costo_unitario': d.get('precio_costo_unitario', 0),
            'subtotal': d['subtotal']
        })
    
    venta_obj = Venta(
        total=total,
        ajuste_monto=ajuste_monto,
        ajuste_detalle=input.ajuste_detalle,
        ganancia_bruta=ganancia_bruta,
        ganancia_neta=ganancia_neta,
        medio_pago=medio_pago,
        cliente_id=input.cliente_id,
        cliente_nombre=cliente_nombre,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        detalles=[DetalleVenta(**d) for d in detalles_para_guardar],
        pagos=pagos_guardar
    )
    
    doc = venta_obj.model_dump()
    doc['fecha'] = doc['fecha'].isoformat()
    
    await db.ventas.insert_one(doc)
    
    # Descuento de stock. Guardamos que productos cambiaron para parchear solo
    # esos ids en el cache de Productos, en vez de invalidar toda esa seccion.
    stocks_actualizados = {}
    for detalle in detalles_finales:
        producto = await db.productos.find_one({'id': detalle['producto_id']})
        if producto:
            if producto.get('tipo') == 'promo' and producto.get('productos_incluidos'):
                for incluido in producto['productos_incluidos']:
                    producto_incluido = await db.productos.find_one({'id': incluido['producto_id']})
                    if producto_incluido:
                        nuevo_stock = producto_incluido.get('stock', 0) - (incluido['cantidad'] * detalle['cantidad'])
                        await db.productos.update_one(
                            {'id': incluido['producto_id']},
                            {'$set': {'stock': nuevo_stock}}
                        )
                        stocks_actualizados[incluido['producto_id']] = nuevo_stock
            else:
                nuevo_stock = producto.get('stock', 0) - detalle['cantidad']
                await db.productos.update_one(
                    {'id': detalle['producto_id']},
                    {'$set': {'stock': nuevo_stock}}
                )
                stocks_actualizados[detalle['producto_id']] = nuevo_stock

    if stocks_actualizados:
        patch_cached_product_stock(stocks_actualizados)
        # El middleware arma el evento con este payload para que Productos
        # parchee solo estos ids, sin recargar toda la seccion.
        request.state.stock_patch = stocks_actualizados
    
    # Procesar pagos a cuenta corriente
    if input.pagos:
        for pago in input.pagos:
            if pago.medio_pago == 'cuenta_corriente' and input.cliente_id:
                movimiento = MovimientoCuentaCorriente(
                    cliente_id=input.cliente_id,
                    concepto=f"Venta #{venta_obj.id[:8]} - {pago.medio_pago}",
                    monto=-pago.monto,
                    venta_id=venta_obj.id,
                    usuario_id=current_user.id,
                    usuario_nombre=current_user.nombre
                )
                mov_doc = movimiento.model_dump()
                mov_doc['fecha'] = mov_doc['fecha'].isoformat()
                await db.movimientos.insert_one(mov_doc)
    elif input.cliente_id and medio_pago == 'cuenta_corriente':
        # Fallback para compatibilidad
        movimiento = MovimientoCuentaCorriente(
            cliente_id=input.cliente_id,
            concepto=f"Venta #{venta_obj.id[:8]}",
            monto=-total,
            venta_id=venta_obj.id,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre
        )
        mov_doc = movimiento.model_dump()
        mov_doc['fecha'] = mov_doc['fecha'].isoformat()
        await db.movimientos.insert_one(mov_doc)
    
    return venta_obj

def _monto_medio_expr(metodo_pago):
    """Expresión de agregación que devuelve el monto cobrado con `metodo_pago`.

    - Si la venta tiene pagos combinados, suma solo los pagos de ese medio.
    - Si es una venta vieja sin `pagos`, usa el total cuando el medio coincide.
    - Sin filtro, devuelve el total completo de la venta.
    """
    if not metodo_pago:
        return "$total"
    return {
        "$cond": [
            {"$gt": [{"$size": {"$ifNull": ["$pagos", []]}}, 0]},
            {"$sum": {
                "$map": {
                    "input": "$pagos",
                    "as": "p",
                    "in": {"$cond": [{"$eq": ["$$p.medio_pago", metodo_pago]}, "$$p.monto", 0]}
                }
            }},
            "$total"
        ]
    }

def _monto_medio_doc(venta, metodo_pago):
    """Versión en Python de _monto_medio_expr para los documentos devueltos."""
    if not metodo_pago:
        return None
    pagos = venta.get('pagos') or []
    if pagos:
        return sum(p.get('monto', 0) for p in pagos if p.get('medio_pago') == metodo_pago)
    return venta.get('total', 0) if venta.get('medio_pago') == metodo_pago else 0

@api_router.get("/ventas")
@cached(domains=("ventas",), prefix="ventas")
async def get_ventas(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    fecha_inicio: str = Query(None),
    fecha_fin: str = Query(None),
    metodo_pago: str = Query(None),
    usuario_id: str = Query(None),
    cliente_id: str = Query(None),
    agrupar_por_dia: bool = Query(False),
    fecha_grupo: str = Query(None, description="Día YYYY-MM-DD del que se quieren las ventas al expandir un grupo"),
    current_user: Usuario = Depends(get_current_user)
):
    solo_mis_datos = False
    
    match_stage = {}
    
    if usuario_id:
        match_stage['usuario_id'] = usuario_id
    
    if cliente_id:
        match_stage['cliente_id'] = cliente_id
    
    if metodo_pago:
        match_stage['$or'] = [
            {'medio_pago': metodo_pago},
            {'pagos.medio_pago': metodo_pago}
        ]
    
# --- REEMPLAZO PARA CORREGIR EL FILTRO DE FECHA ---
    if fecha_inicio or fecha_fin:
        match_stage['fecha'] = {}
        # Definimos tu zona horaria (Argentina UTC-3)
        tz_ar = timezone(timedelta(hours=-3))
        
        if fecha_inicio:
            # Tomamos el inicio del día local y lo pasamos a UTC para buscar en la DB
            dt_inicio_local = datetime.strptime(fecha_inicio[:10], "%Y-%m-%d").replace(tzinfo=tz_ar)
            dt_inicio_utc = dt_inicio_local.astimezone(timezone.utc)
            match_stage['fecha']['$gte'] = dt_inicio_utc.isoformat()
            
        if fecha_fin:
            # Tomamos el final del día local y lo pasamos a UTC para buscar en la DB
            dt_fin_local = datetime.strptime(fecha_fin[:10], "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999, tzinfo=tz_ar
            )
            dt_fin_utc = dt_fin_local.astimezone(timezone.utc)
            match_stage['fecha']['$lte'] = dt_fin_utc.isoformat()
    # ------------------------------------------------

    # Monto a sumar en las estadísticas: si hay filtro de medio, solo la porción de ese medio
    monto_expr = _monto_medio_expr(metodo_pago)

    # Un único día para agrupar, contar y expandir: el front pide `fecha_grupo`
    # con la misma fecha que muestra la fila, así el detalle coincide con el
    # total del grupo aunque la hora sea distinta según la zona horaria.
    fecha_str_stage = {
        "$addFields": {
            "fecha_str": {
                "$cond": {
                    "if": {"$eq": [{"$type": "$fecha"}, "string"]},
                    "then": "$fecha",
                    "else": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$fecha"}}
                }
            }
        }
    }
    grupo_stages = []
    if fecha_grupo:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fecha_grupo):
            raise HTTPException(status_code=400, detail="fecha_grupo debe tener formato YYYY-MM-DD")
        grupo_stages.append({
            "$match": {
                "$expr": {"$eq": [{"$substr": ["$fecha_str", 0, 10]}, fecha_grupo]}
            }
        })

    if agrupar_por_dia:
        # Antes se hacía $push de $$ROOT por día: eso materializaba TODAS las
        # ventas de cada grupo aunque el front solo mostrara los totales.
        # Ahora el group solo acumula números; las ventas se piden al expandir.
        pipeline = [
            {"$match": match_stage},
            fecha_str_stage,
            *grupo_stages,
            {
                "$group": {
                    "_id": {"$substr": ["$fecha_str", 0, 10]},
                    "total_bruto": {"$sum": monto_expr},
                    "total_neto": {"$sum": {"$ifNull": ["$ganancia_neta", 0]}},
                    "cantidad_ventas": {"$sum": 1}
                }
            },
            {"$sort": {"_id": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit}
        ]
        
        cursor = db.ventas.aggregate(pipeline)
        resultados = await cursor.to_list(limit)
        
        count_pipeline = [
            {"$match": match_stage},
            fecha_str_stage,
            *grupo_stages,
            {"$group": {"_id": {"$substr": ["$fecha_str", 0, 10]}}},
            {"$count": "total_dias"}
        ]
        count_cursor = db.ventas.aggregate(count_pipeline)
        count_result = await count_cursor.to_list(1)
        total_dias = count_result[0]['total_dias'] if count_result else 0
        
        stats_pipeline = [
            {"$match": match_stage},
            fecha_str_stage,
            *grupo_stages,
            {
                "$group": {
                    "_id": None,
                    "total_bruto": {"$sum": monto_expr},
                    "total_neto": {"$sum": {"$ifNull": ["$ganancia_neta", 0]}},
                    "cantidad_ventas": {"$sum": 1},
                    "dias_unicos": {"$addToSet": {"$substr": ["$fecha_str", 0, 10]}}
                }
            }
        ]
        stats_cursor = db.ventas.aggregate(stats_pipeline)
        stats_result = await stats_cursor.to_list(1)
        
        if stats_result:
            stats_data = stats_result[0]
            total_bruto = stats_data.get('total_bruto', 0)
            total_neto = stats_data.get('total_neto', 0)
            total_ventas = stats_data.get('cantidad_ventas', 0)
            dias_unicos = len(stats_data.get('dias_unicos', []))
            promedio_diario = total_bruto / dias_unicos if dias_unicos > 0 else 0
        else:
            total_bruto = 0
            total_neto = 0
            total_ventas = 0
            dias_unicos = 0
            promedio_diario = 0
        
        # Solo totales por día. El front trae las ventas de un día cuando el
        # usuario lo expande (misma query, con fecha_grupo y agrupar_por_dia=false).
        grupos_result = [
            {
                'date': grupo['_id'],
                'total': grupo.get('total_bruto', 0),
                'ganancia_neta': grupo.get('total_neto', 0),
                'count': grupo.get('cantidad_ventas', 0),
            }
            for grupo in resultados
        ]
        
        return {
            "ventas": grupos_result,
            "grupos": grupos_result,
            "pagination": {
                "total": total_dias,
                "pages": math.ceil(total_dias / limit) if total_dias > 0 else 0,
                "page": page
            },
            "stats": {
                "total_bruto": round(total_bruto, 2),
                "total_neto": round(total_neto, 2),
                "cantidad": dias_unicos,
                "promedio": round(promedio_diario, 2),
                "promedio_neto": round(total_neto / dias_unicos, 2) if dias_unicos > 0 else 0,
                "cantidad_ventas": total_ventas
            }
        }
    else:
        # En el listado normal no hace falta calcular fecha_str; solo se
        # agrega (y se quita del resultado) cuando pedimos un día concreto.
        proyecto_ventas = {"_id": 0, "fecha_str": 0} if fecha_grupo else {"_id": 0}
        pipeline = [
            {"$match": match_stage},
            *([fecha_str_stage, *grupo_stages] if fecha_grupo else []),
            {"$project": proyecto_ventas},
            {"$sort": {"fecha": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit}
        ]
        
        cursor = db.ventas.aggregate(pipeline)
        ventas_paginadas = await cursor.to_list(limit)
        
        if fecha_grupo:
            count_grupo_pipeline = [
                {"$match": match_stage},
                fecha_str_stage,
                *grupo_stages,
                {"$count": "total"}
            ]
            count_grupo_result = await db.ventas.aggregate(count_grupo_pipeline).to_list(1)
            total_count = count_grupo_result[0]['total'] if count_grupo_result else 0
        else:
            total_count = await db.ventas.count_documents(match_stage)
        
        stats_pipeline = [
            {"$match": match_stage},
            fecha_str_stage,
            *grupo_stages,
            {
                "$group": {
                    "_id": None,
                    "total_bruto": {"$sum": monto_expr},
                    "total_neto": {"$sum": {"$ifNull": ["$ganancia_neta", 0]}},
                    "dias_unicos": {"$addToSet": {"$substr": ["$fecha_str", 0, 10]}}
                }
            }
        ]
        stats_cursor = db.ventas.aggregate(stats_pipeline)
        stats_result = await stats_cursor.to_list(1)
        
        if stats_result:
            stats_data = stats_result[0]
            total_bruto = stats_data.get('total_bruto', 0)
            total_neto = stats_data.get('total_neto', 0)
            dias_unicos = len(stats_data.get('dias_unicos', []))
            promedio = total_bruto / total_count if total_count > 0 else 0
        else:
            total_bruto = 0
            total_neto = 0
            dias_unicos = 0
            promedio = 0
        
        for v in ventas_paginadas:
            if isinstance(v.get('fecha'), str):
                v['fecha'] = datetime.fromisoformat(v['fecha'])
            if metodo_pago:
                v['monto_filtrado'] = _monto_medio_doc(v, metodo_pago)
        
        return {
            "ventas": ventas_paginadas,
            "pagination": {
                "total": total_count,
                "pages": math.ceil(total_count / limit) if total_count > 0 else 0,
                "page": page
            },
            "stats": {
                "total_bruto": round(total_bruto, 2),
                "total_neto": round(total_neto, 2),
                "cantidad": total_count,
                "promedio": round(promedio, 2),
                "promedio_neto": round(total_neto / total_count, 2) if total_count > 0 else 0,
                "dias_unicos": dias_unicos
            }
        }

# --- RECOMENDACIONES / INSIGHTS (modelos y lógica en recommendations.py) ---

@api_router.get("/recomendaciones", response_model=Recomendaciones)
@cached(domains=("recomendaciones", "productos",), prefix="recomendaciones")
async def get_recomendaciones(current_user: Usuario = Depends(get_current_user)):
    """Recomendaciones de stock basadas en velocidad de venta (últimos 30 días).

    Calcula:
      - Top productos vendidos (por unidades).
      - Productos a reponer (el stock no cubre ~7 días según la velocidad de venta).
      - Productos con mucho stock y baja rotación (candidatos a no reponer / ofertar).
    """
    periodo_dias = 30
    now = datetime.now(timezone.utc)
    fecha_limite = (now - timedelta(days=periodo_dias)).isoformat()

    # 1) Unidades vendidas por producto en los últimos 30 días
    pipeline = [
        {'$match': {'fecha': {'$gte': fecha_limite}}},
        {'$unwind': '$detalles'},
        {'$group': {
            '_id': '$detalles.producto_id',
            'nombre': {'$first': '$detalles.producto_nombre'},
            'unidades': {'$sum': '$detalles.cantidad'},
            'monto': {'$sum': '$detalles.subtotal'}
        }}
    ]
    ventas_agg_list = await db.ventas.aggregate(pipeline).to_list(10000)

    ventas_por_producto = {}
    for v in ventas_agg_list:
        ventas_por_producto[v['_id']] = {
            'nombre': v.get('nombre') or 'Producto',
            'unidades': int(v.get('unidades', 0)),
            'monto': round(float(v.get('monto', 0)), 2)
        }

    # 2) Productos y su stock actual
    productos = await db.productos.find({}, {'_id': 0, 'id': 1, 'nombre': 1, 'stock': 1}).to_list(10000)
    info_productos = {p.get('id'): p for p in productos if p.get('id')}

    # La lógica de cálculo vive en recommendations.py: es una función pura, testable sin BD
    return calcular_recomendaciones(
        ventas_por_producto=ventas_por_producto,
        info_productos=info_productos,
        periodo_dias=periodo_dias,
        now=now,
    )

@api_router.get("/ventas/{venta_id}", response_model=Venta)
@cached(domains=("ventas",), prefix="ventas-venta_id")
async def get_venta(venta_id: str, current_user: Usuario = Depends(get_current_user)):
    venta = await db.ventas.find_one({'id': venta_id}, {'_id': 0})
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    if isinstance(venta.get('fecha'), str):
        venta['fecha'] = datetime.fromisoformat(venta['fecha'])
    
    return Venta(**venta)

# ===== DASHBOARD ROUTES =====

@api_router.get("/dashboard/stats", response_model=DashboardStats)
@cached(domains=("dashboard",), prefix="dashboard-stats")
async def get_dashboard_stats(current_user: Usuario = Depends(get_current_user)):
    # Verificar si el usuario quiere solo sus datos
    solo_mis_datos = current_user.preferencias.get('soloMisDatos', False) if current_user.preferencias else False

    # Obtener fecha actual en UTC para coincidir con cómo se guardan los datos
    ahora_utc = datetime.now(timezone.utc)
    # Convertir a fecha local para obtener el día correcto en la zona horaria local
    ahora_local = ahora_utc.astimezone(TZ_ARGENTINA)
    
    # Crear rangos del día en UTC para comparación con base de datos
    hoy_inicio_utc = ahora_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    hoy_fin_utc = ahora_local.replace(hour=23, minute=59, second=59, microsecond=999999).astimezone(timezone.utc)
    
    hoy_inicio_str = hoy_inicio_utc.isoformat()
    hoy_fin_str = hoy_fin_utc.isoformat()

    # Rango local de ayer, en UTC para comparar con la base de datos.
    ayer_local = ahora_local - timedelta(days=1)
    ayer_inicio_utc = ayer_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    ayer_fin_utc = ayer_local.replace(hour=23, minute=59, second=59, microsecond=999999).astimezone(timezone.utc)
    ayer_inicio_str = ayer_inicio_utc.isoformat()
    ayer_fin_str = ayer_fin_utc.isoformat()
    
    # Filtro base para ventas y egresos
    filtro_fecha = {'fecha': {'$gte': hoy_inicio_str, '$lte': hoy_fin_str}}
    filtro_fecha_ayer = {'fecha': {'$gte': ayer_inicio_str, '$lte': ayer_fin_str}}
    
    # Filtrar ventas del día actual (00:00:00 - 23:59:59)
    if solo_mis_datos:
        filtro_ventas = {**filtro_fecha, 'usuario_id': current_user.id}
        filtro_ventas_ayer = {**filtro_fecha_ayer, 'usuario_id': current_user.id}
    else:
        filtro_ventas = filtro_fecha
        filtro_ventas_ayer = filtro_fecha_ayer
    
    ventas_hoy = await db.ventas.find(filtro_ventas, {'_id': 0}).to_list(1000)
    ventas_ayer = await db.ventas.find(filtro_ventas_ayer, {'_id': 0}).to_list(1000)
    
    total_vendido = sum(v['total'] for v in ventas_hoy)
    total_vendido_ayer = sum(v['total'] for v in ventas_ayer)
    cantidad_ventas = len(ventas_hoy)

    # Últimas ventas del día para el dashboard. Se derivan de `ventas_hoy`, que
    # ya viene filtrado por usuario cuando está activo "Solo mis datos".
    ultimas_ventas = []
    for venta in sorted(ventas_hoy, key=lambda v: v.get('fecha') or '', reverse=True)[:4]:
        medios = []
        for pago in (venta.get('pagos') or []):
            medio = pago.get('medio_pago')
            if medio and medio not in medios:
                medios.append(medio)
        if not medios and venta.get('medio_pago'):
            medios = [venta['medio_pago']]

        fecha = venta.get('fecha')
        if isinstance(fecha, datetime):
            fecha = fecha.isoformat()

        ultimas_ventas.append({
            'id': venta.get('id') or venta.get('_id'),
            'fecha': fecha,
            'total': venta.get('total', 0),
            'medio_pago': ' + '.join(medios) if medios else 'desconocido',
        })
    
    ventas_por_medio = {}
    for venta in ventas_hoy:
        # Si tiene pagos múltiples, usarlos; si no, usar medio_pago
        if 'pagos' in venta and venta['pagos']:
            for pago in venta['pagos']:
                medio = pago.get('medio_pago', 'desconocido')
                monto = pago.get('monto', 0)
                ventas_por_medio[medio] = ventas_por_medio.get(medio, 0) + monto
        else:
            medio = venta['medio_pago']
            ventas_por_medio[medio] = ventas_por_medio.get(medio, 0) + venta['total']
    
    # Saldo de cuenta corriente y ultimo movimiento por cliente en UNA sola
    # agregacion. Antes se hacia una query por cliente (y otra para su ultimo
    # movimiento): ~57 viajes secuenciales a Atlas = ~12s de espera.
    clientes = await db.clientes.find({}, {'_id': 0, 'id': 1, 'nombre': 1}).to_list(1000)
    ids_clientes = [c['id'] for c in clientes if c.get('id')]
    movimientos_agg = await db.movimientos.aggregate([
        {'$match': {'cliente_id': {'$in': ids_clientes}}},
        {'$group': {
            '_id': '$cliente_id',
            'saldo': {'$sum': '$monto'},
            'ultima_fecha': {'$max': '$fecha'},
        }},
    ]).to_list(1000)
    resumen_clientes = {m['_id']: m for m in movimientos_agg}
    total_saldo_cuenta_corriente = sum(m['saldo'] for m in movimientos_agg)
    
# Obtener egresos del día (mismo criterio que ventas)
    if solo_mis_datos:
        filtro_egresos = {**filtro_fecha, 'usuario_id': current_user.id}
    else:
        filtro_egresos = filtro_fecha
    
    egresos_hoy = await db.egresos.find(filtro_egresos, {'_id': 0}).to_list(1000)
    total_egresos_hoy = sum(e['monto'] for e in egresos_hoy)
    
    # Obtener ingresos de cuenta corriente del día (movimientos positivos)
    movimientos_cta_cte_hoy = await db.movimientos.find({
        'fecha': {'$gte': hoy_inicio_str, '$lte': hoy_fin_str},
        'monto': {'$gt': 0}
    }, {'_id': 0}).to_list(1000)
    ingresos_cta_cte_hoy = sum(m['monto'] for m in movimientos_cta_cte_hoy)
    
    # Clientes con movimientos, reutilizando la agregacion de arriba.
    ultimos_clientes = []
    for cliente in clientes:
        resumen = resumen_clientes.get(cliente['id'])
        if not resumen:
            continue
        ultimos_clientes.append({
            'cliente_nombre': cliente['nombre'],
            'cliente_id': cliente['id'],
            'ultima_fecha': resumen.get('ultima_fecha'),
            'saldo': resumen['saldo'],
        })
    
    # Ordenar por saldo (menor a mayor: los que más deben primero)
    ultimos_clientes = sorted(
        ultimos_clientes, 
        key=lambda x: x.get('saldo', 0)
    )[:4]
    
    # Convertir fechas a strings para JSON
    for c in ultimos_clientes:
        if isinstance(c.get('ultima_fecha'), datetime):
            c['ultima_fecha'] = c['ultima_fecha'].isoformat()
    
    # Verificar productos con bajo stock para notificaciones
    productos = await db.productos.find(
        {}, {'_id': 0, 'id': 1, 'nombre': 1, 'stock': 1}
    ).to_list(1000)
    productos_bajo_stock = [p for p in productos if p.get('stock', 0) < 10]
    
    # Crear notificaciones si hay productos con bajo stock y no existen notificaciones no leídas
    if productos_bajo_stock and await db.notificaciones.count_documents({'leida': False}) == 0:
        for producto in productos_bajo_stock[:5]:  # Limitar a 5 para no sobrecargar
            await db.notificaciones.insert_one({
                'id': str(uuid.uuid4()),
                'tipo': 'bajo_stock',
                'mensaje': f'Bajo stock: {producto["nombre"]} - Solo quedan {producto["stock"]} unidades',
                'productos': [{'id': producto["id"], 'nombre': producto["nombre"], 'stock': producto["stock"]}],
                'fecha': datetime.now(timezone.utc),
                'leida': False
            })
    
    # Calcular caja_real: efectivo + transferencia + posnet + ingresos_cta_cte_hoy
    caja_real = (
        ventas_por_medio.get('efectivo', 0) +
        ventas_por_medio.get('transferencia', 0) +
        ventas_por_medio.get('posnet', 0) +
        ingresos_cta_cte_hoy
    )
    
    return DashboardStats(
        total_vendido_hoy=total_vendido,
        total_vendido_ayer=total_vendido_ayer,
        cantidad_ventas_hoy=cantidad_ventas,
        ventas_por_medio_pago=ventas_por_medio,
        total_saldo_cuenta_corriente=total_saldo_cuenta_corriente,
        total_egresos_hoy=total_egresos_hoy,
        ingresos_cta_cte_hoy=ingresos_cta_cte_hoy,
        caja_real=caja_real,
        ultimos_clientes_cta_cte=ultimos_clientes,
        ultimas_ventas=ultimas_ventas
    )

# ===== PROVEEDORES ROUTES =====

@api_router.post("/proveedores", response_model=Proveedor)
async def create_proveedor(
    request: Request,
    input: ProveedorCreate, 
    current_user: Usuario = Depends(get_current_user)
):
    # Verificar si ya existe un proveedor con el mismo nombre
    existing = await db.proveedores.find_one({"nombre": input.nombre})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Ya existe un proveedor con el nombre '{input.nombre}'"
        )
    
    proveedor_obj = Proveedor(**input.model_dump())
    doc = proveedor_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.proveedores.insert_one(doc)
    
    # Registrar auditoría
    await registrar_auditoria(
        entidad='proveedor',
        entidad_id=proveedor_obj.id,
        entidad_nombre=proveedor_obj.nombre,
        accion='creado',
        valores_nuevos=input.model_dump(),
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    return proveedor_obj

@api_router.get("/proveedores", response_model=List[dict])
@cached(domains=("proveedores", "movimientos",), prefix="proveedores")
async def get_proveedores(current_user: Usuario = Depends(get_current_user)):
    proveedores = await db.proveedores.find({}, {'_id': 0}).to_list(1000)
    
    for p in proveedores:
        if isinstance(p.get('timestamp'), str):
            p['timestamp'] = datetime.fromisoformat(p['timestamp'])
        
        # Calcular saldo para cada proveedor
        movimientos = await db.movimientos.find({'proveedor_id': p['id']}, {'_id': 0}).to_list(1000)
        saldo = sum(m['monto'] for m in movimientos)
        p['saldo'] = saldo
    
    return proveedores

@api_router.get("/proveedores/{proveedor_id}", response_model=Proveedor)
@cached(domains=("proveedores",), prefix="proveedores-proveedor_id")
async def get_proveedor(proveedor_id: str, current_user: Usuario = Depends(get_current_user)):
    proveedor = await db.proveedores.find_one({'id': proveedor_id}, {'_id': 0})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    if isinstance(proveedor.get('timestamp'), str):
        proveedor['timestamp'] = datetime.fromisoformat(proveedor['timestamp'])
    
    return Proveedor(**proveedor)

@api_router.put("/proveedores/{proveedor_id}", response_model=Proveedor)
async def update_proveedor(
    request: Request,
    proveedor_id: str, 
    input: ProveedorUpdate, 
    current_user: Usuario = Depends(get_current_user)
):
    proveedor = await db.proveedores.find_one({'id': proveedor_id}, {'_id': 0})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    # Guardar valores anteriores
    valores_anteriores = {
        'nombre': proveedor.get('nombre'),
        'telefono': proveedor.get('telefono'),
        'email': proveedor.get('email'),
        'direccion': proveedor.get('direccion'),
        'cuit': proveedor.get('cuit')
    }
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.proveedores.update_one({'id': proveedor_id}, {'$set': update_data})
        
        # Registrar auditoría
        await registrar_auditoria(
            entidad='proveedor',
            entidad_id=proveedor_id,
            entidad_nombre=proveedor.get('nombre'),
            accion='modificado',
            valores_anteriores=valores_anteriores,
            valores_nuevos=update_data,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre,
            ip_address=request.client.host if request.client else None
        )
    
    updated_proveedor = await db.proveedores.find_one({'id': proveedor_id}, {'_id': 0})
    if not updated_proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    if isinstance(updated_proveedor.get('timestamp'), str):
        updated_proveedor['timestamp'] = datetime.fromisoformat(updated_proveedor['timestamp'])
    
    return Proveedor(**updated_proveedor)

@api_router.delete("/proveedores/{proveedor_id}")
async def delete_proveedor(
    request: Request,
    proveedor_id: str, 
    current_user: Usuario = Depends(get_current_user)
):
    # Obtener proveedor antes de eliminar para auditoría
    proveedor = await db.proveedores.find_one({'id': proveedor_id}, {'_id': 0})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    # Registrar auditoría antes de eliminar
    await registrar_auditoria(
        entidad='proveedor',
        entidad_id=proveedor_id,
        entidad_nombre=proveedor.get('nombre'),
        accion='eliminado',
        valores_anteriores=proveedor,
        valores_nuevos=None,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    result = await db.proveedores.delete_one({'id': proveedor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    return {"message": "Proveedor eliminado"}

# ===== CUENTA CORRIENTE ROUTES =====

@api_router.get("/clientes/{cliente_id}/cuenta-corriente", response_model=CuentaCorrienteInfo)
@cached(domains=("clientes", "movimientos",), prefix="clientes-cliente_id-cuenta-corriente")
async def get_cuenta_corriente_cliente(cliente_id: str, current_user: Usuario = Depends(get_current_user)):
    cliente = await db.clientes.find_one({'id': cliente_id}, {'_id': 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    if isinstance(cliente.get('timestamp'), str):
        cliente['timestamp'] = datetime.fromisoformat(cliente['timestamp'])
    
    movimientos = await db.movimientos.find({'cliente_id': cliente_id}, {'_id': 0}).sort('fecha', -1).to_list(1000)
    
    for m in movimientos:
        if isinstance(m.get('fecha'), str):
            m['fecha'] = datetime.fromisoformat(m['fecha'])
    
    saldo = sum(m['monto'] for m in movimientos)
    
    movimientos_asc = sorted(movimientos, key=lambda x: x.get('fecha', datetime.min))
    saldo_acumulado = 0
    for m in movimientos_asc:
        saldo_acumulado += m.get('monto', 0)
        m['saldo_hasta_movimiento'] = saldo_acumulado
    
    movimientos = sorted(movimientos, key=lambda x: x.get('fecha', datetime.min), reverse=True)
    
    return CuentaCorrienteInfo(
        cliente=Cliente(**cliente),
        saldo=saldo,
        movimientos=[MovimientoCuentaCorriente(**m) for m in movimientos]
    )

@api_router.get("/movimientos-todos")
@cached(domains=("clientes", "movimientos",), prefix="movimientos-todos")
async def get_todos_movimientos_cta_cte(current_user: Usuario = Depends(get_current_user)):
    """Obtiene todos los movimientos de todas las cuentas corrientes"""
    
    clientes = await db.clientes.find({}, {'_id': 0, 'id': 1, 'nombre': 1}).to_list(1000)
    
    movimientosTodos = []
    saldos_clientes = {}
    
    for cliente in clientes:
        movimientos = await db.movimientos.find(
            {'cliente_id': cliente['id']}, 
            {'_id': 0}
        ).sort('fecha', 1).to_list(1000)
        
        saldo_acumulado = 0
        for mov in movimientos:
            saldo_acumulado += mov.get('monto', 0)
            mov['saldo_hasta_movimiento'] = saldo_acumulado
        
        movimientos_ordenados = sorted(movimientos, key=lambda x: x.get('fecha', datetime.min), reverse=True)
        
        for mov in movimientos_ordenados:
            mov['cliente_nombre'] = cliente['nombre']
            if isinstance(mov.get('fecha'), str):
                mov['fecha'] = datetime.fromisoformat(mov['fecha'])
        
        movimientosTodos.extend(movimientos_ordenados)
    
    movimientosTodos.sort(key=lambda x: x.get('fecha', datetime.min), reverse=True)
    
    return movimientosTodos[:500]

@api_router.get("/proveedores/{proveedor_id}/cuenta-corriente", response_model=CuentaCorrienteInfo)
@cached(domains=("proveedores", "movimientos",), prefix="proveedores-proveedor_id-cuenta-corriente")
async def get_cuenta_corriente_proveedor(proveedor_id: str, current_user: Usuario = Depends(get_current_user)):
    proveedor = await db.proveedores.find_one({'id': proveedor_id}, {'_id': 0})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    if isinstance(proveedor.get('timestamp'), str):
        proveedor['timestamp'] = datetime.fromisoformat(proveedor['timestamp'])
    
    movimientos = await db.movimientos.find({'proveedor_id': proveedor_id}, {'_id': 0}).sort('fecha', -1).to_list(1000)
    
    for m in movimientos:
        if isinstance(m.get('fecha'), str):
            m['fecha'] = datetime.fromisoformat(m['fecha'])
    
    saldo = sum(m['monto'] for m in movimientos)
    
    return CuentaCorrienteInfo(
        proveedor=Proveedor(**proveedor),
        saldo=saldo,
        movimientos=[MovimientoCuentaCorriente(**m) for m in movimientos]
    )

@api_router.post("/clientes/{cliente_id}/movimientos", response_model=MovimientoCuentaCorriente)
async def create_movimiento_cliente(cliente_id: str, concepto: str, monto: float, current_user: Usuario = Depends(get_current_user)):
    cliente = await db.clientes.find_one({'id': cliente_id}, {'_id': 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    movimiento = MovimientoCuentaCorriente(
        cliente_id=cliente_id,
        concepto=concepto,
        monto=monto,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre
    )
    
    doc = movimiento.model_dump()
    doc['fecha'] = doc['fecha'].isoformat()
    
    await db.movimientos.insert_one(doc)
    return movimiento

@api_router.post("/proveedores/{proveedor_id}/movimientos", response_model=MovimientoCuentaCorriente)
async def create_movimiento_proveedor(proveedor_id: str, concepto: str, monto: float, current_user: Usuario = Depends(get_current_user)):
    proveedor = await db.proveedores.find_one({'id': proveedor_id}, {'_id': 0})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    movimiento = MovimientoCuentaCorriente(
        proveedor_id=proveedor_id,
        concepto=concepto,
        monto=monto,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre
    )
    
    doc = movimiento.model_dump()
    doc['fecha'] = doc['fecha'].isoformat()
    
    await db.movimientos.insert_one(doc)
    return movimiento

# ===== EGRESOS ROUTES =====

@api_router.post("/egresos", response_model=Egreso)
async def create_egreso(
    request: Request,
    input: EgresoCreate, 
    current_user: Usuario = Depends(get_current_user)
):
    egreso_obj = Egreso(
        **{k: v for k, v in input.model_dump().items() if k not in ['usuario_id', 'usuario_nombre']},
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre
    )
    doc = egreso_obj.model_dump()
    doc['fecha'] = doc['fecha'].isoformat()
    
    await db.egresos.insert_one(doc)
    
    # Registrar auditoría
    await registrar_auditoria(
        entidad='egreso',
        entidad_id=egreso_obj.id,
        entidad_nombre=egreso_obj.descripcion,
        accion='creado',
        valores_nuevos=input.model_dump(),
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    return egreso_obj

@api_router.get("/egresos", response_model=List[Egreso])
@cached(domains=("egresos",), prefix="egresos")
async def get_egresos(current_user: Usuario = Depends(get_current_user)):
    egresos = await db.egresos.find({}, {'_id': 0}).sort('fecha', -1).to_list(1000)
    
    for e in egresos:
        if isinstance(e.get('fecha'), str):
            e['fecha'] = datetime.fromisoformat(e['fecha'])
    
    return egresos

@api_router.get("/egresos/{egreso_id}", response_model=Egreso)
@cached(domains=("egresos",), prefix="egresos-egreso_id")
async def get_egreso(egreso_id: str, current_user: Usuario = Depends(get_current_user)):
    egreso = await db.egresos.find_one({'id': egreso_id}, {'_id': 0})
    if not egreso:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    if isinstance(egreso.get('fecha'), str):
        egreso['fecha'] = datetime.fromisoformat(egreso['fecha'])
    
    return Egreso(**egreso)

@api_router.put("/egresos/{egreso_id}", response_model=Egreso)
async def update_egreso(
    request: Request,
    egreso_id: str, 
    input: EgresoUpdate, 
    current_user: Usuario = Depends(get_current_user)
):
    egreso = await db.egresos.find_one({'id': egreso_id}, {'_id': 0})
    if not egreso:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    # Guardar valores anteriores
    valores_anteriores = {
        'descripcion': egreso.get('descripcion'),
        'monto': egreso.get('monto'),
        'categoria': egreso.get('categoria')
    }
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.egresos.update_one({'id': egreso_id}, {'$set': update_data})
        
        # Registrar auditoría
        await registrar_auditoria(
            entidad='egreso',
            entidad_id=egreso_id,
            entidad_nombre=egreso.get('descripcion'),
            accion='modificado',
            valores_anteriores=valores_anteriores,
            valores_nuevos=update_data,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre,
            ip_address=request.client.host if request.client else None
        )
    
    updated_egreso = await db.egresos.find_one({'id': egreso_id}, {'_id': 0})
    if not updated_egreso:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    if isinstance(updated_egreso.get('fecha'), str):
        updated_egreso['fecha'] = datetime.fromisoformat(updated_egreso['fecha'])
    
    return Egreso(**updated_egreso)

@api_router.delete("/egresos/{egreso_id}")
async def delete_egreso(
    request: Request,
    egreso_id: str, 
    current_user: Usuario = Depends(get_current_user)
):
    # Obtener egreso antes de eliminar para auditoría
    egreso = await db.egresos.find_one({'id': egreso_id}, {'_id': 0})
    if not egreso:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    # Registrar auditoría antes de eliminar
    await registrar_auditoria(
        entidad='egreso',
        entidad_id=egreso_id,
        entidad_nombre=egreso.get('descripcion'),
        accion='eliminado',
        valores_anteriores=egreso,
        valores_nuevos=None,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    result = await db.egresos.delete_one({'id': egreso_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    
    return {"message": "Egreso eliminado"}

# ===== ENDPOINT TEMPORAL PARA MIGRACIÓN =====

@api_router.post("/fix-admin-role")
async def fix_admin_role():
    """Endpoint temporal para asegurar que el usuario admin tenga rol de administrador"""
    try:
        # Actualizar usuario admin a rol de administrador
        result = await db.usuarios.update_one(
            {'username': 'admin'},
            {'$set': {'rol': 'admin'}}
        )
        
        # Actualizar cualquier usuario sin rol a admin (por compatibilidad)
        await db.usuarios.update_many(
            {'rol': {'$exists': False}},
            {'$set': {'rol': 'admin'}}
        )
        
        # Verificar resultado
        admin_user = await db.usuarios.find_one({'username': 'admin'}, {'_id': 0, 'password': 0})
        
        return {
            "message": "Usuario admin actualizado correctamente",
            "updated_count": result.modified_count,
            "admin_user": admin_user
        }
    except Exception as e:
        return {"error": str(e)}

# ===== USUARIOS ROUTES =====

@api_router.get("/usuarios", response_model=List[dict])
@cached(domains=("usuarios",), prefix="usuarios")
async def get_usuarios_basicos(current_user: Usuario = Depends(get_current_user)):
    """Retorna lista básica de usuarios (id, nombre) para filtros - accesible para todos los usuarios autenticados"""
    usuarios = await db.usuarios.find({}, {'_id': 0, 'password': 0, 'rol': 0, 'timestamp': 0}).to_list(1000)
    return usuarios

# ===== ADMIN USUARIOS ROUTES =====

@api_router.get("/admin/usuarios", response_model=List[Usuario])
@cached(domains=("usuarios",), prefix="admin-usuarios")
async def get_all_usuarios(current_user: Usuario = Depends(get_admin_user)):
    usuarios = await db.usuarios.find({}, {'_id': 0, 'password': 0}).to_list(1000)
    
    for u in usuarios:
        if isinstance(u.get('timestamp'), str):
            u['timestamp'] = datetime.fromisoformat(u['timestamp'])
    
    return usuarios

@api_router.post("/admin/usuarios", response_model=Usuario)
async def admin_create_usuario(
    request: Request,
    input: UsuarioCreate, 
    current_user: Usuario = Depends(get_admin_user)
):
    existing = await db.usuarios.find_one({'username': input.username})
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    hashed_password = bcrypt.hashpw(input.password.encode('utf-8'), bcrypt.gensalt())
    
    usuario_obj = Usuario(username=input.username, nombre=input.nombre, rol=input.rol)
    doc = usuario_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    doc['password'] = hashed_password.decode('utf-8')
    
    await db.usuarios.insert_one(doc)
    
    # Registrar auditoría (sin contraseña por seguridad)
    valores_nuevos = {
        'username': input.username,
        'nombre': input.nombre,
        'rol': input.rol
    }
    
    await registrar_auditoria(
        entidad='usuario',
        entidad_id=usuario_obj.id,
        entidad_nombre=usuario_obj.nombre,
        accion='creado',
        valores_nuevos=valores_nuevos,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    return usuario_obj

@api_router.get("/admin/usuarios/{usuario_id}", response_model=Usuario)
@cached(domains=("usuarios",), prefix="admin-usuarios-usuario_id")
async def get_usuario(usuario_id: str, current_user: Usuario = Depends(get_admin_user)):
    usuario = await db.usuarios.find_one({'id': usuario_id}, {'_id': 0, 'password': 0})
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if isinstance(usuario.get('timestamp'), str):
        usuario['timestamp'] = datetime.fromisoformat(usuario['timestamp'])
    
    return Usuario(**usuario)

@api_router.put("/admin/usuarios/{usuario_id}", response_model=Usuario)
async def admin_update_usuario(
    request: Request,
    usuario_id: str, 
    input: UsuarioUpdate, 
    current_user: Usuario = Depends(get_admin_user)
):
    usuario = await db.usuarios.find_one({'id': usuario_id}, {'_id': 0, 'password': 0})
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Evitar que un usuario admin se cambie a sí mismo a rol común
    if current_user.id == usuario_id and 'rol' in input.model_dump() and input.rol != 'admin':
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol de administrador")
    
# Guardar valores anteriores
    valores_anteriores = {
        'username': usuario.get('username'),
        'nombre': usuario.get('nombre'),
        'rol': usuario.get('rol')
    }
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    # Si hay contraseña, encriptarla antes de guardar
    if 'password' in update_data and update_data['password']:
        update_data['password'] = bcrypt.hashpw(update_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    if update_data:
        await db.usuarios.update_one({'id': usuario_id}, {'$set': update_data})
        
        # Registrar auditoría (sin contraseña por seguridad)
        valores_nuevos_auditoria = {k: v for k, v in update_data.items() if k != 'password'}
        await registrar_auditoria(
            entidad='usuario',
            entidad_id=usuario_id,
            entidad_nombre=usuario.get('nombre'),
            accion='modificado',
            valores_anteriores=valores_anteriores,
            valores_nuevos=valores_nuevos_auditoria,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre,
            ip_address=request.client.host if request.client else None
        )
    
    updated_usuario = await db.usuarios.find_one({'id': usuario_id}, {'_id': 0, 'password': 0})
    if not updated_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if isinstance(updated_usuario.get('timestamp'), str):
        updated_usuario['timestamp'] = datetime.fromisoformat(updated_usuario['timestamp'])
    
    return Usuario(**updated_usuario)

@api_router.delete("/admin/usuarios/{usuario_id}")
async def admin_delete_usuario(
    request: Request,
    usuario_id: str, 
    current_user: Usuario = Depends(get_admin_user)
):
    # Evitar que un usuario se elimine a sí mismo
    if current_user.id == usuario_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    
    # Verificar si es el último admin
    # Excluir password: este documento se guarda en la auditoría (valores_anteriores).
    usuario_a_eliminar = await db.usuarios.find_one({'id': usuario_id}, {'_id': 0, 'password': 0})
    if usuario_a_eliminar and usuario_a_eliminar.get('rol') == 'admin':
        total_admins = await db.usuarios.count_documents({'rol': 'admin'})
        if total_admins <= 1:
            raise HTTPException(status_code=400, detail="No puedes eliminar al último administrador del sistema")
    
    # Registrar auditoría antes de eliminar
    await registrar_auditoria(
        entidad='usuario',
        entidad_id=usuario_id,
        entidad_nombre=usuario_a_eliminar.get('nombre'),
        accion='eliminado',
        valores_anteriores=usuario_a_eliminar,
        valores_nuevos=None,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        ip_address=request.client.host if request.client else None
    )
    
    result = await db.usuarios.delete_one({'id': usuario_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return {"message": "Usuario eliminado"}

# ===== LIMPIEZA DE BASE DE DATOS =====

@api_router.get("/admin/colecciones")
async def listar_colecciones_disponibles(current_user: Usuario = Depends(get_admin_user)):
    """Lista todas las colecciones de la base de datos"""
    try:
        colecciones = await db.list_collection_names()
        info_colecciones = {}
        
        for coleccion in colecciones:
            try:
                count = await db[f'{coleccion}'].count_documents({})
                info_colecciones[coleccion] = count
            except:
                info_colecciones[coleccion] = "Error al contar"
        
        return {
            "colecciones": colecciones,
            "registros_por_coleccion": info_colecciones
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar colecciones: {str(e)}")

# ===== STICKY NOTES ENDPOINTS =====

@api_router.post("/sticky-notes", response_model=StickyNote)
async def crear_sticky_note(
    note: StickyNoteCreate, 
    current_user: Usuario = Depends(get_current_user)
):
    """Crea una nueva sticky note"""
    try:
        sticky_note = StickyNote(
            texto=note.texto,
            autor_id=current_user.id,
            autor_nombre=current_user.nombre,
            color=note.color,
            fijada=note.fijada
        )
        
        await db["sticky_notes"].insert_one(sticky_note.model_dump())
        
        # Registrar auditoría
        await registrar_auditoria(
            entidad="sticky_note",
            entidad_id=sticky_note.id,
            accion="creado",
            valores_nuevos=sticky_note.model_dump(),
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre
        )
        
        return sticky_note
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear sticky note: {str(e)}")

@api_router.get("/sticky-notes", response_model=List[dict])
@cached(domains=("sticky_notes",), prefix="sticky-notes")
async def obtener_sticky_notes(current_user: Usuario = Depends(get_current_user)):
    """Obtiene todas las sticky notes (visibles para todos)"""
    try:
        sticky_notes = []
        cursor = db["sticky_notes"].find()
        
        async for document in cursor:
            # Convertir ObjectId a string y eliminar _id
            if '_id' in document:
                document['_id'] = str(document['_id'])
            
            # Agregar timestamp relativo
            editada = document.get('editada', False)
            
            # Si la nota fue editada, usar fecha_actualizacion para calcular el tiempo
            if editada:
                timestamp = document.get('fecha_actualizacion') or document.get('timestamp')
            else:
                timestamp = document.get('timestamp')
            
            tiempo_relativo = ""
            now = datetime.now(timezone.utc)
            if timestamp:
                # Manejar timestamp con o sin timezone
                if timestamp.tzinfo is None:
                    # Si no tiene timezone, asumir UTC
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                
                diff = now - timestamp
                if diff.days > 0:
                    tiempo_relativo = f"hace {diff.days} día{'s' if diff.days != 1 else ''}"
                elif diff.seconds > 3600:
                    hours = diff.seconds // 3600
                    tiempo_relativo = f"hace {hours} hora{'s' if hours != 1 else ''}"
                elif diff.seconds > 60:
                    minutes = diff.seconds // 60
                    tiempo_relativo = f"hace {minutes} min"
                else:
                    tiempo_relativo = "hace instantes"
            
            if editada:
                tiempo_relativo = f"editado {tiempo_relativo}"
            
            # Calcular tiempo relativo de cada comentario
            comentarios = document.get('comentarios', [])
            for comentario in comentarios:
                fecha_com = comentario.get('fecha')
                if fecha_com:
                    if fecha_com.tzinfo is None:
                        fecha_com = fecha_com.replace(tzinfo=timezone.utc)
                    diff_com = now - fecha_com
                    if diff_com.days > 0:
                        comentario['tiempo_relativo'] = f"hace {diff_com.days} día{'s' if diff_com.days != 1 else ''}"
                    elif diff_com.seconds > 3600:
                        hours = diff_com.seconds // 3600
                        comentario['tiempo_relativo'] = f"hace {hours} hora{'s' if hours != 1 else ''}"
                    elif diff_com.seconds > 60:
                        minutes = diff_com.seconds // 60
                        comentario['tiempo_relativo'] = f"hace {minutes} min"
                    else:
                        comentario['tiempo_relativo'] = "hace instantes"
            
            # Crear una copia sin el _id para evitar problemas de serialización
            doc_copy = {k: v for k, v in document.items() if k != '_id'}
            doc_copy['tiempo_relativo'] = tiempo_relativo
            sticky_notes.append(doc_copy)
            
        def _fecha_orden(doc):
            ts = doc.get('fecha_actualizacion') or doc.get('timestamp')
            if ts is None:
                return 0
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            return ts.timestamp()
        
        # Fijadas primero, y dentro de cada grupo por la más reciente (creada o modificada)
        sticky_notes.sort(key=lambda d: ((0 if d.get('fijada') else 1), -_fecha_orden(d)))
        
        return sticky_notes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener sticky notes: {str(e)}")

@api_router.put("/sticky-notes/{note_id}", response_model=dict)
async def actualizar_sticky_note(
    note_id: str,
    note_update: StickyNoteUpdate,
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza una sticky note (solo el autor puede editar)"""
    try:
        # Verificar que la nota existe
        existing_note = await db["sticky_notes"].find_one({"id": note_id})
        if not existing_note:
            raise HTTPException(status_code=404, detail="Sticky note no encontrada")
        
        # Verificar que el usuario actual es el autor
        if existing_note.get("autor_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Solo el autor puede editar esta nota")
        
        # Preparar campos a actualizar
        update_data = {
            "editada": True,
            "fecha_actualizacion": datetime.now(timezone.utc)
        }  # Siempre marcar como editada y actualizar timestamp
        if note_update.texto is not None:
            update_data["texto"] = note_update.texto
        if note_update.color is not None:
            update_data["color"] = note_update.color
        if note_update.fijada is not None:
            update_data["fijada"] = note_update.fijada
            
        await db["sticky_notes"].update_one(
            {"id": note_id},
            {"$set": update_data}
        )
        
        # Obtener la nota actualizada
        updated_note = await db["sticky_notes"].find_one({"id": note_id})
        
        if not updated_note:
            raise HTTPException(status_code=404, detail="Sticky note no encontrada después de actualizar")
        
        # Registrar auditoría
        await registrar_auditoria(
            entidad="sticky_note",
            entidad_id=note_id,
            accion="modificado",
            valores_anteriores=existing_note,
            valores_nuevos=updated_note,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre
        )
        
        # Calcular tiempo_relativo para la respuesta
        editada = updated_note.get('editada', False)
        if editada:
            ts = updated_note.get('fecha_actualizacion') or updated_note['timestamp']
        else:
            ts = updated_note['timestamp']
        
        if ts and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        
        tiempo_relativo = ""
        if ts:
            now = datetime.now(timezone.utc)
            diff = now - ts
            if diff.days > 0:
                tiempo_relativo = f"hace {diff.days} día{'s' if diff.days != 1 else ''}"
            elif diff.seconds > 3600:
                hours = diff.seconds // 3600
                tiempo_relativo = f"hace {hours} hora{'s' if hours != 1 else ''}"
            elif diff.seconds > 60:
                minutes = diff.seconds // 60
                tiempo_relativo = f"hace {minutes} min"
            else:
                tiempo_relativo = "hace instantes"
        
        if editada:
            tiempo_relativo = f"editado {tiempo_relativo}"
        
        return {
            "id": updated_note['id'],
            "texto": updated_note['texto'],
            "autor_id": updated_note['autor_id'],
            "autor_nombre": updated_note['autor_nombre'],
            "color": updated_note['color'],
            "fijada": updated_note['fijada'],
            "editada": updated_note.get('editada', False),
            "timestamp": updated_note['timestamp'],
            "fecha_actualizacion": updated_note.get('fecha_actualizacion'),
            "comentarios": updated_note.get('comentarios', []),
            "tiempo_relativo": tiempo_relativo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar sticky note: {str(e)}")

@api_router.delete("/sticky-notes/{note_id}")
async def eliminar_sticky_note(
    note_id: str,
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina una sticky note (solo el autor puede eliminar)"""
    try:
        # Verificar que la nota existe y obtener el autor
        existing_note = await db["sticky_notes"].find_one({"id": note_id})
        if not existing_note:
            raise HTTPException(status_code=404, detail="Sticky note no encontrada")
        
        # Verificar que el usuario actual es el autor
        if existing_note.get('autor_id') != current_user.id:
            raise HTTPException(status_code=403, detail="Solo el autor puede eliminar esta sticky note")
        
        # Eliminar la nota
        await db["sticky_notes"].delete_one({"id": note_id})
        
        # Registrar auditoría
        await registrar_auditoria(
            entidad="sticky_note",
            entidad_id=note_id,
            accion="eliminado",
            valores_anteriores=existing_note,
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre
        )
        
        return {"message": "Sticky note eliminada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar sticky note: {str(e)}")

@api_router.post("/sticky-notes/{note_id}/comentarios", response_model=dict)
async def agregar_comentario_sticky_note(
    note_id: str,
    comentario: StickyNoteComentario,
    current_user: Usuario = Depends(get_current_user)
):
    """Agrega un comentario a una sticky note (cualquier usuario puede comentar)"""
    try:
        existing_note = await db["sticky_notes"].find_one({"id": note_id})
        if not existing_note:
            raise HTTPException(status_code=404, detail="Sticky note no encontrada")
        
        fecha_comentario = datetime.now(timezone.utc)
        nuevo_comentario = {
            "id": str(uuid.uuid4()),
            "texto": comentario.texto,
            "autor_nombre": current_user.nombre,
            "autor_id": current_user.id,
            "fecha": fecha_comentario,
            "tiempo_relativo": "hace instantes"
        }
        
        comentarios = existing_note.get("comentarios", [])
        comentarios.append(nuevo_comentario)
        
        await db["sticky_notes"].update_one(
            {"id": note_id},
            {"$set": {"comentarios": comentarios}}
        )
        
        return nuevo_comentario
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al agregar comentario: {str(e)}")

# ===== MERCADOPAGO - TRANSFERENCIAS =====

@api_router.get("/mercadopago/buscar-transferencias")
async def buscar_transferencias(
    minutos: int = 60,
    current_user: Usuario = Depends(get_current_user)
):
    """Busca transferencias/dinero recibido en los últimos X minutos"""
    try:
        mp_config = await db["configuracion"].find_one({"tipo": "mercadopago"})
        access_token = mp_config.get("access_token") if mp_config else None
        
        if not access_token:
            raise HTTPException(status_code=400, detail="MERCADOPAGO_ACCESS_TOKEN no configurado")
        
        from datetime import timedelta
        from zoneinfo import ZoneInfo
        from dateutil import parser as date_parser
        import httpx
        
        end_date = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires"))
        start_date = end_date - timedelta(minutes=minutos)
        
        url = "https://api.mercadopago.com/v1/payments/search"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        params = {"sort": "date_created", "criteria": "desc", "limit": 100}
        
        # Las transferencias viven en la API de MP: cachearlas congelaba la
        # ventana de fechas. Sin cache, el timeout evita colgar el modal.
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Error de Mercadopago")
            data = response.json()
        
        transferencias = []
        for payment in data.get("results", []):
            payment_type = payment.get("payment_type_id", "")
            operation_type = payment.get("operation_type", "")
            status = payment.get("status", "")
            date_created_str = payment.get("date_created", "")
            
            if date_created_str:
                try:
                    payment_date = date_parser.parse(date_created_str)
                    if payment_date < start_date:
                        continue
                except:
                    pass
            
            if (payment_type in ["bank_transfer", "account_money"] or operation_type in ["transfer", "account_fund"]) and status == "approved":
                payer = payment.get("payer", {})
                payer_extra = payment.get("additional_info", {}).get("payer", {})
                transferencias.append({
                    "id": payment.get("id"),
                    "monto": payment.get("transaction_amount", payment.get("amount", 0)),
                    "currency": payment.get("currency", "ARS"),
                    "estado": status,
                    "tipo_pago": payment_type,
                    "tipo_operacion": operation_type,
                    "descripcion": payment.get("description"),
                    "referencia_externa": payment.get("external_reference"),
                    "metodo_pago": payment.get("payment_method_id"),
                    "fecha_creacion": payment.get("date_created"),
                    "fecha_aprobacion": payment.get("date_approved"),
                    "payer_email": payer.get("email"),
                    "payer_nombre": payer.get("first_name") or payer.get("name") or payer_extra.get("first_name"),
                    "payer_apellido": payer.get("last_name") or payer.get("surname") or payer_extra.get("last_name"),
                    "payer_identificacion": payer.get("identification", {}),
                    "payer_telefono": payer.get("phone", {}) or payer_extra.get("phone", {}),
                    "payer_extra": payer_extra,
                    "cardholder_name": payment.get("card", {}).get("cardholder", {}).get("name"),
                    "raw": payment,
                })
        
        return {"transferencias": transferencias, "cantidad": len(transferencias), "busqueda_minutos": minutos}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/mercadopago/buscar-ventas-coincidentes")
@cached(domains=("mp", "ventas",), prefix="mercadopago-buscar-ventas-coincidentes")
async def buscar_ventas_coincidentes(
    monto: float,
    fecha_inicio: str,
    fecha_fin: str,
    transferencia_id: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user)
):
    """Busca ventas que coincidan con una transferencia por monto y rango de fecha"""
    try:
        from dateutil import parser as date_parser
        
        dt_inicio = date_parser.parse(fecha_inicio)
        dt_fin = date_parser.parse(fecha_fin)
        
        filtro_combinado = {
            "fecha": {
                "$gte": dt_inicio.isoformat(),
                "$lte": dt_fin.isoformat()
            },
            "pagos": {"$elemMatch": {"medio_pago": "transferencia", "monto": monto}}
        }
        
        ventas = await db.ventas.find(filtro_combinado, {"_id": 0}).sort("fecha", -1).to_list(20)
        
        filtro_sin_fecha = {
            "pagos": {"$elemMatch": {"medio_pago": "transferencia", "monto": monto}}
        }
        ventas_transferencia = await db.ventas.find(filtro_sin_fecha, {"_id": 0}).sort("fecha", -1).to_list(50)
        
        if transferencia_id:
            config_asociacion = await db["configuracion"].find_one({
                "tipo": "transferencias_asociaciones",
                f"transferencias.{transferencia_id}": {"$exists": True}
            })
            
            if config_asociacion:
                venta_asociada_id = config_asociacion.get("transferencias", {}).get(transferencia_id)
                for v in ventas:
                    v["ya_asociada"] = (v.get("id") == venta_asociada_id)
                for v in ventas_transferencia:
                    v["ya_asociada"] = (v.get("id") == venta_asociada_id)
        
        return {
            "ventas_coincidentes": ventas, 
            "ventas_transferencia": ventas_transferencia,
            "cantidad": len(ventas),
            "debug": {
                "monto_buscado": monto,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "ventas_en_fecha": len(ventas),
                "ventas_transferencia": len(ventas_transferencia)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/mercadopago/asociar-transferencia")
async def asociar_transferencia_venta(
    request: Request,
    current_user: Usuario = Depends(get_current_user)
):
    """Asocia una transferencia de MP con una venta existente"""
    data = await request.json()
    transferencia_id = data.get("transferencia_id")
    venta_id = data.get("venta_id")
    
    if not transferencia_id or not venta_id:
        raise HTTPException(status_code=400, detail="Faltan transferencia_id o venta_id")
    
    try:
        venta = await db.ventas.find_one({"id": venta_id})
        if not venta:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        
        await db["configuracion"].update_one(
            {"tipo": "transferencias_asociaciones"},
            {
                "$set": {
                    f"transferencias.{transferencia_id}": venta_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": current_user.id
                }
            },
            upsert=True
        )
        
        return {"success": True, "message": "Transferencia asociada correctamente", "venta_id": venta_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/mercadopago/obtener-asociaciones")
@cached(domains=("mp", "ventas",), prefix="mercadopago-obtener-asociaciones")
async def obtener_asociaciones(
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene todas las asociaciones de transferencias con ventas"""
    try:
        config = await db["configuracion"].find_one({"tipo": "transferencias_asociaciones"})
        if not config:
            return {"asociaciones": {}, "ventas_asociadas": {}}
        
        asociaciones = config.get("transferencias", {})
        
        ventas_ids = list(asociaciones.values())
        ventas = {}
        if ventas_ids:
            cursor = db.ventas.find({"id": {"$in": ventas_ids}}, {"_id": 0})
            async for v in cursor:
                ventas[v["id"]] = v
        
        resultado = {}
        for transf_id, venta_id in asociaciones.items():
            resultado[transf_id] = {
                "venta_id": venta_id,
                "venta": ventas.get(venta_id)
            }
        
        return {"asociaciones": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== CONFIGURACIÓN MERCADOPAGO =====

@api_router.get("/mercadopago/configuracion")
@cached(domains=("mp",), prefix="mercadopago-configuracion")
async def get_configuracion_mercadopago(
    current_user: Usuario = Depends(get_admin_user)
):
    """Obtiene la configuración de Mercadopago"""
    try:
        config = await db["configuracion"].find_one({"tipo": "mercadopago"})
        if config:
            # Convertir ObjectId a string
            if "_id" in config:
                config["_id"] = str(config["_id"])
            # No retornar el token completo por seguridad
            access_token = config.get("access_token", "")
            if access_token:
                config["access_token"] = access_token[:8] + "..." if len(access_token) > 8 else "***"
        return config or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/mercadopago/configuracion")
async def set_configuracion_mercadopago(
    request: Request,
    current_user: Usuario = Depends(get_admin_user)
):
    """Guarda la configuración de Mercadopago"""
    try:
        body = await request.json()
        access_token = body.get("access_token", "")
        
        config_data = {
            "tipo": "mercadopago",
            "access_token": access_token,
            "fecha_actualizacion": datetime.now(timezone.utc)
        }
        
        await db["configuracion"].update_one(
            {"tipo": "mercadopago"},
            {"$set": config_data},
            upsert=True
        )
        
        return {"message": "Configuración guardada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== NOVEDADES (modal forzado por backend) =====

DEFAULT_NOVEDADES = {
    "version": "v1.07.0",
    "features": [
        {
            "icon": "FileText",
            "title": "Presupuestos con link público",
            "description": "Ahora podés armar presupuestos y compartirlos con un enlace público sin inicio de sesión, con los precios actualizados al abrirlo. Incluye descuentos por monto o porcentaje, PDF e impresión.",
        },
        {
            "icon": "Sparkles",
            "title": "Nueva interfaz (en proceso)",
            "description": "Estamos renovando el escritorio: sidebar, cards, notas y menú flotante con un nuevo diseño. Todavía está en proceso, así que pueden aparecer ajustes.",
        },
        {
            "icon": "Save",
            "title": "Nueva Venta con borrador persistente",
            "description": "Ahora lo que cargás en \"Nueva Venta\" se guarda automáticamente y no se pierde si cambiás de pantalla o recargás. El borrador se limpia al registrar la venta o al cancelar.",
        },
        {
            "icon": "Move",
            "title": "Botón flotante arrastrable",
            "description": "El menú de accesos rápidos ahora se puede arrastrar y soltar en cualquier parte de la pantalla, guardando su posición por usuario. Doble clic para restablecerlo.",
        },
        {
            "icon": "Bot",
            "title": "Chat IA",
            "description": "Implementamos el Chat IA para consultar datos del sistema (ventas, productos, cuentas corrientes, proveedores, egresos, MercadoPago y auditoría) con historial por usuario.",
        },
        {
            "icon": "Mic",
            "title": "Dictado por voz en el Chat IA",
            "description": "Ahora podés dictar tus consultas en el Chat IA usando el micrófono. Tu voz se transcribe automáticamente para que puedas revisarla y enviarla.",
        },
        {
            "icon": "Tags",
            "title": "Categorías de productos",
            "description": "Ahora podés organizar los productos por categorías (por ejemplo, vinos o gaseosas): crealas, editá su nombre o eliminalas desde la sección Productos y asignalas a cada producto.",
        },
    ],
}


class NovedadesConfig(BaseModel):
    version: str
    features: List[dict]


@api_router.get("/novedades/version")
@cached(domains=("novedades",), prefix="novedades-version")
async def get_novedades_version():
    """Endpoint liviano para polling: devuelve solo la versión activa."""
    try:
        config = await db["configuracion"].find_one({"tipo": "novedades"}, {"_id": 0, "version": 1})
        version = (config or {}).get("version") or DEFAULT_NOVEDADES["version"]
        return {"version": version}
    except Exception:
        return {"version": DEFAULT_NOVEDADES["version"]}


@api_router.get("/novedades")
@cached(domains=("novedades",), prefix="novedades")
async def get_novedades():
    """Obtiene novedades completas. Público: el polling no renueva la sesión."""
    try:
        config = await db["configuracion"].find_one({"tipo": "novedades"}, {"_id": 0})
        if not config:
            return DEFAULT_NOVEDADES
        version = config.get("version") or DEFAULT_NOVEDADES["version"]
        features = config.get("features") if isinstance(config.get("features"), list) and config.get("features") else DEFAULT_NOVEDADES["features"]
        return {"version": version, "features": features}
    except Exception:
        return DEFAULT_NOVEDADES


@api_router.put("/novedades")
async def set_novedades(payload: NovedadesConfig, current_user: Usuario = Depends(get_admin_user)):
    """Actualiza novedades (admin). Cambiar version fuerza a que se muestre el modal en clientes activos."""
    try:
        doc = {
            "tipo": "novedades",
            "version": payload.version,
            "features": payload.features,
            "fecha_actualizacion": datetime.now(timezone.utc).isoformat(),
        }
        await db["configuracion"].update_one({"tipo": "novedades"}, {"$set": doc}, upsert=True)
        return {"message": "Novedades actualizadas", "version": payload.version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== CHAT IA (solo lectura) =====

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: Optional[List[ChatMessage]] = None
    message: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    # Datos estructurados de la última tool consultada (ranking / tiempos), para
    # que el frontend pueda dibujar una tabla ordenable sin parsear el texto.
    data: Optional[Dict[str, Any]] = None


class ChatHistoryItem(BaseModel):
    role: str
    content: str
    fecha: Optional[datetime] = None
    # Datos estructurados de la ultima tool (tablas), para reconstruirlos al recargar.
    data: Optional[Dict[str, Any]] = None


async def _save_chat_message(user_id: str, role: str, content: str, data: Optional[Dict[str, Any]] = None):
    doc = {
        "user_id": user_id,
        "role": role,
        "content": content,
        "fecha": datetime.now(timezone.utc).isoformat(),
    }
    if data is not None:
        doc["data"] = data
    await db.chat_mensajes.insert_one(doc)


@api_router.get("/chat/history", response_model=List[ChatHistoryItem])
@cached(domains=("chat",), prefix="chat-history")
async def get_chat_history(
    limit: int = 200,
    current_user: Usuario = Depends(get_current_user)
):
    limit = max(1, min(int(limit or 200), 500))
    docs = await db.chat_mensajes.find(
        {"user_id": current_user.id},
        {"_id": 0, "role": 1, "content": 1, "fecha": 1, "data": 1}
    ).sort("fecha", 1).limit(limit).to_list(limit)
    items = []
    for d in docs:
        fecha = d.get("fecha")
        if isinstance(fecha, str):
            try:
                fecha = datetime.fromisoformat(fecha)
            except Exception:
                fecha = None
        items.append(ChatHistoryItem(
            role=d.get("role", "assistant"),
            content=d.get("content", ""),
            fecha=fecha,
            data=d.get("data"),
        ))
    return items


@api_router.delete("/chat/history")
async def clear_chat_history(current_user: Usuario = Depends(get_current_user)):
    await db.chat_mensajes.delete_many({"user_id": current_user.id})
    return {"message": "Historial eliminado"}


@api_router.post("/chat", response_model=ChatResponse)
@limiter.limit("10/minute")  # Evita abusos de un endpoint que consume tokens de IA
async def chat_ia(request: Request, body: ChatRequest, current_user: Usuario = Depends(get_current_user)):
    # Determinar el nuevo mensaje del usuario
    user_text = (body.message or "").strip()
    if not user_text and body.messages:
        for m in reversed(body.messages):
            if m.role == "user" and m.content and m.content.strip():
                user_text = m.content.strip()
                break
    if not user_text:
        raise HTTPException(status_code=400, detail="Falta el mensaje del usuario")

    # Cargar historial persistido como contexto (limitado para reducir consumo de tokens)
    context_limit = max(2, int(os.environ.get("CHAT_MAX_MESSAGES", "8") or 8))
    history_docs = await db.chat_mensajes.find(
        {"user_id": current_user.id},
        {"_id": 0, "role": 1, "content": 1}
    ).sort("fecha", -1).limit(context_limit).to_list(context_limit)
    history_docs.reverse()
    msgs = [{"role": d.get("role"), "content": d.get("content", "")} for d in history_docs if d.get("role") in ("user", "assistant")]
    msgs.append({"role": "user", "content": user_text})

    collector: Dict[str, Any] = {}
    reply = await run_chat(msgs, db, current_user, collector=collector)

    # Persistir intercambio
    try:
        await _save_chat_message(current_user.id, "user", user_text)
        await _save_chat_message(current_user.id, "assistant", reply or "", collector.get("ultimo"))
    except Exception:
        pass

    return ChatResponse(reply=reply, data=collector.get("ultimo"))


@api_router.get("/ia/metricas/tiempo-trabajado")
@cached(domains=("metricas",), prefix="ia-metricas-tiempo-trabajado")
async def ia_tiempo_trabajado(
    usuario_id: Optional[str] = Query(None),
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    agrupar: str = Query("dia", pattern="^(dia|semana|mes|total)$"),
    current_user: Usuario = Depends(get_current_user),
):
    """Horas estimadas por día/semana/mes/total. Un usuario común sólo ve las suyas."""
    if usuario_id and usuario_id != current_user.id and current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Sólo los administradores pueden consultar las métricas de otros usuarios.")
    if not usuario_id and current_user.rol != "admin":
        usuario_id = current_user.id
    return await calcular_tiempo_trabajado(db, usuario_id, desde, hasta, agrupar)


@api_router.get("/ia/metricas/ranking")
@cached(domains=("metricas",), prefix="ia-metricas-ranking")
async def ia_ranking(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    ordenar_por: str = Query("score"),
    ascendente: bool = Query(False),
    pesos: Optional[str] = Query(None),
    current_user: Usuario = Depends(get_current_user),
):
    """Ranking de empleados. Sólo administradores."""
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="El ranking de empleados es exclusivo de administradores.")
    return await calcular_ranking(db, desde, hasta, ordenar_por, ascendente, pesos)


@api_router.post("/chat/transcribe")
@limiter.limit("10/minute")  # La transcripción también consume recursos externos
async def chat_transcribe(
    request: Request,
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
):
    """Transcribe un audio a texto (para dictado por voz en el chat)."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="No se recibió audio.")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El audio es demasiado grande (máx. 10 MB).")
    text = await transcribe_audio(
        data,
        filename=file.filename or "audio.webm",
        content_type=file.content_type or "",
    )
    return {"text": text}

app.include_router(api_router)
app.include_router(public_router)

async def limpiar_base_de_datos(current_user: Usuario = Depends(get_admin_user)):
    """Elimina todos los datos excepto productos y usuarios"""
    try:
        logger.info("Iniciando limpieza de base de datos...")
        
        # Colecciones a limpiar (manteniendo productos y usuarios)
        colecciones = [
            'clientes',
            'proveedores',
            'ventas', 
            'movimientos',
            'egresos',
            'notificaciones'
        ]
        
        resultados = {}
        colecciones_existentes = await db.list_collection_names()
        logger.info(f"Colecciones existentes: {colecciones_existentes}")
        
        for coleccion in colecciones:
            if coleccion in colecciones_existentes:
                try:
                    resultado = await db[f'{coleccion}'].delete_many({})
                    resultados[coleccion] = resultado.deleted_count
                    logger.info(f"Eliminados {resultado.deleted_count} documentos de {coleccion}")
                except Exception as coleccion_error:
                    logger.error(f"Error al limpiar {coleccion}: {str(coleccion_error)}")
                    resultados[coleccion] = f"Error: {str(coleccion_error)}"
            else:
                logger.info(f"Colección {coleccion} no existe")
                resultados[coleccion] = 0  # No existía la colección
        
        logger.info("Limpieza de base de datos completada")
        return {
            "message": "Base de datos limpiada exitosamente",
            "eliminados": resultados,
            "mantenidos": ["productos", "usuarios"],
            "colecciones_verificadas": colecciones_existentes
        }
    except Exception as e:
        import logging
        logging.error(f"Error en limpieza de base de datos: {str(e)}")
        import traceback
        logging.error(f"Traceback completo: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error al limpiar base de datos: {str(e)}")

# ===== ENDPOINTS DIRECTOS EN APP (temporal para diagnóstico) =====

@app.get("/admin/colecciones-direct")
async def listar_colecciones_directo():
    """Endpoint directo en app para diagnóstico"""
    try:
        colecciones = await db.list_collection_names()
        info_colecciones = {}
        
        for coleccion in colecciones:
            try:
                count = await db[f'{coleccion}'].count_documents({})
                info_colecciones[coleccion] = count
            except:
                info_colecciones[coleccion] = "Error al contar"
        
        return {
            "message": "Endpoint directo funcionando",
            "colecciones": colecciones,
            "registros_por_coleccion": info_colecciones
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/limpiar-base-datos-direct")
async def limpiar_base_de_datos_direct(current_user: Usuario = Depends(get_admin_user)):
    """Endpoint directo en app para limpieza (solo admin)"""
    try:
        # Colecciones a limpiar (manteniendo productos y usuarios)
        colecciones = [
            'clientes',
            'proveedores',
            'ventas', 
            'movimientos',
            'egresos',
            'notificaciones'
        ]
        
        resultados = {}
        colecciones_existentes = await db.list_collection_names()
        
        for coleccion in colecciones:
            if coleccion in colecciones_existentes:
                try:
                    resultado = await db[f'{coleccion}'].delete_many({})
                    resultados[coleccion] = resultado.deleted_count
                    print(f"✅ Eliminados {resultado.deleted_count} documentos de {coleccion}")
                except Exception as coleccion_error:
                    resultados[coleccion] = f"Error: {str(coleccion_error)}"
                    print(f"❌ Error al limpiar {coleccion}: {str(coleccion_error)}")
            else:
                resultados[coleccion] = 0
        
        return {
            "message": "Base de datos limpiada (endpoint directo)",
            "eliminados": resultados,
            "mantenidos": ["productos", "usuarios"]
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/limpiar-base-datos-test")
async def limpiar_test_sin_auth(current_user: Usuario = Depends(get_admin_user)):
    """Endpoint de prueba: también requiere admin"""
    try:
        colecciones = ['clientes', 'ventas']
        resultados = {}
        
        for coleccion in colecciones:
            resultado = await db[f'{coleccion}'].delete_many({})
            resultados[coleccion] = resultado.deleted_count
            print(f"✅ Eliminados {resultado.deleted_count} de {coleccion}")
        
        return {
            "message": "Test sin auth completado",
            "eliminados": resultados
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/limpiar-auditoria-direct")
async def limpiar_auditoria_direct(request: Request, current_user: Usuario = Depends(get_admin_user)):
    """Endpoint directo para limpiar auditoría (solo admin)"""
    try:
        # Obtener entidades a eliminar del body
        body = await request.json()
        entidades = body.get('entidades', [])
        
        # Si no se selecciona ninguna entidad, no eliminar nada
        if not entidades or len(entidades) == 0:
            return {"error": "Selecciona al menos un tipo de registro a eliminar"}
        
        # Construir filtro
        filtro = {"entidad": {"$in": entidades}}
        
        # Limpiar auditoría
        resultado = await db.auditoria.delete_many(filtro)
        return {
            "message": "Registros de auditoría eliminados exitosamente",
            "eliminados": resultado.deleted_count
        }
    except Exception as e:
        return {"error": f"Error al limpiar auditoría: {str(e)}"}

@app.post("/limpiar-login-registros-direct")
async def limpiar_login_registros_direct(request: Request, current_user: Usuario = Depends(get_admin_user)):
    """Endpoint directo para limpiar registros de login (solo admin)"""
    try:
        # Limpiar registros de login
        resultado = await db.login_registros.delete_many({})
        return {
            "message": "Registros de login eliminados exitosamente",
            "eliminados": resultado.deleted_count
        }
    except Exception as e:
        return {"error": f"Error al limpiar registros de login: {str(e)}"}

# Debug endpoint para verificar registro
@app.get("/debug")
async def debug_info():
    try:
        # Implementación simple sin depender de atributos internos
        return {
            "message": "Debug endpoint funcionando",
            "test": "Funciona",
            "status": "Backend activo"
        }
    except Exception as e:
        return {"error": str(e)}

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Data-Domains", "X-Data-Event-Id", "X-Data-Patch"],
)

# Middleware simple para bloquear bots sospechosos
class SecurityMiddleware(BaseHTTPMiddleware):
    BLOCKED_IPS = {
        "193.142.147.209",
        "3.143.33.63", 
        "147.185.132.114"
    }
    BLOCKED_RANGES = {"216.218.206.0/24"}
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        
        # Bloquear IPs específicas
        if client_ip in self.BLOCKED_IPS:
            return Response(status_code=403, content="Access Denied")
        
        # Bloquear patrones sospechosos
        if request.url.path == "/" and request.method in ["POST", "CONNECT"]:
            return Response(status_code=403, content="Access Denied")
            
        response = await call_next(request)
        return response

# ===== CREAR ÍNDICES AL INICIAR =====
async def create_indexes():
    """Crear índices para optimizar rendimiento"""
    
    # Productos: eliminar índice conflictivo
    try:
        await db.productos.drop_index("nombre_text")
        print("Índice nombre_text eliminado de productos")
    except Exception:
        pass
    
    try:
        await db.productos.drop_index("nombre_text_categoria_text")
        print("Índice nombre_text_categoria_text eliminado de productos")
    except Exception:
        pass
    
    # Verificar estado de índices
    try:
        auditoria_indexes = await db.auditoria.index_information()
        print(f"Índices actuales de auditoria: {list(auditoria_indexes.keys())}")
    except Exception as e:
        print(f"Error verificando índices: {e}")
    
    # PRODUCTOS
    try:
        await db.productos.create_index(
            [("nombre", "text"), ("categoria", "text")],
            name="busqueda_global_text"
        )
        print("Índice busqueda_global_text creado en productos")
    except Exception as e:
        print(f"Error creando índice de texto en productos: {e}")
    
    try:
        await db.productos.create_index([("categoria", 1), ("nombre", 1)])
    except Exception as e:
        print(f"Error creando índice compuesto en productos: {e}")
    
    # VENTAS
    try:
        await db.ventas.create_index([("fecha", -1)])
    except Exception as e:
        print(f"Error creando índice en ventas.fecha: {e}")
    
    try:
        await db.ventas.create_index("cliente_id")
    except Exception as e:
        print(f"Error creando índice en ventas.cliente_id: {e}")
    
    try:
        await db.ventas.create_index([("fecha", -1), ("total", 1)])
    except Exception as e:
        print(f"Error creando índice compuesto en ventas: {e}")
    
    # MOVIMIENTOS
    try:
        await db.movimientos.create_index("cliente_id")
    except Exception as e:
        print(f"Error creando índice en movimientos.cliente_id: {e}")
    
    try:
        await db.movimientos.create_index("fecha")
    except Exception as e:
        print(f"Error creando índice en movimientos.fecha: {e}")
    
    try:
        await db.movimientos.create_index([("cliente_id", 1), ("fecha", -1)])
    except Exception as e:
        print(f"Error creando índice compuesto en movimientos: {e}")
    
    # EGRESOS
    try:
        await db.egresos.create_index("fecha")
    except Exception as e:
        print(f"Error creando índice en egresos.fecha: {e}")
    
    try:
        await db.egresos.create_index("categoria")
    except Exception as e:
        print(f"Error creando índice en egresos.categoria: {e}")
    
    # AUDITORIA - Recrear con nombre único para evitar conflictos
    try:
        await db.auditoria.create_index(
            [("fecha", 1)],
            name="fecha_ttl_index",
            expireAfterSeconds=2592000
        )
    except Exception as e:
        print(f"Error creando índice TTL en auditoria: {e}")
    
    # USUARIOS
    try:
        await db.usuarios.create_index("username", unique=True)
    except Exception as e:
        print(f"Error creando índice único en usuarios.username: {e}")
    
    # CLIENTES - Índice único para DNI
    try:
        await db.clientes.create_index("dni", unique=True, sparse=True)
    except Exception as e:
        print(f"Error creando índice único en clientes.dni: {e}")
    

    # CHAT - historial por usuario
    try:
        await db.chat_mensajes.create_index([("user_id", 1), ("fecha", 1)])
    except Exception as e:
        print(f"Error creando índice en chat_mensajes: {e}")

    # Confirmación de creación de índices
    print("=" * 50)
    print("ÍNDICES CREADOS:")
    print("  ✓ Ventas (fecha, cliente_id, compuesto)")
    print("  ✓ Movimientos (cliente_id, fecha, compuesto)")
    print("  ✓ Egresos (fecha, categoria)")
    print("  ✓ Auditoría (TTL)")
    print("  ✓ Usuarios (username único)")
    print("  ✓ Productos (texto, compuesto)")
    print("  ✓ Clientes (dni único)")
    print("=" * 50)

@app.on_event("startup")
async def startup_event():
    await create_indexes()
    # Warm-up opcional (desactivado por defecto): activar con CHAT_WARMUP=true
    if os.environ.get("CHAT_WARMUP", "false").lower() == "true":
        asyncio.create_task(warmup_chat_model())

app.add_middleware(SecurityMiddleware)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()