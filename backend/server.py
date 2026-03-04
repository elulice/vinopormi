from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, Query
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
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import math
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

api_router = APIRouter()
security = HTTPBearer()

JWT_SECRET = os.environ.get('JWT_SECRET', 'vinoteca-secret-key-2024')
JWT_ALGORITHM = 'HS256'

# ===== MODELS =====

class Usuario(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    nombre: str
    rol: str = "comun"  # "admin" o "comun"
    preferencias: dict = Field(default_factory=lambda: {"showCents": True, "sidebarWidth": "normal", "floatingMenu": False, "autoLogout": True, "soloMisDatos": False})  # Preferencias del usuario
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
    image_url: Optional[str] = None

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
    cantidad_ventas_hoy: int
    ventas_por_medio_pago: dict
    total_saldo_cuenta_corriente: float
    total_egresos_hoy: float
    ingresos_cta_cte_hoy: float = 0
    ultimos_clientes_cta_cte: list = []

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

public_router = APIRouter()

@public_router.get("/public/destacados", response_model=List[ProductoPublico])
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
            filter_conditions.append({"$or": or_conditions})
        else:
            filter_conditions.append({
                "$or": [
                    {"nombre": {"$regex": search, "$options": "i"}},
                    {"categoria": {"$regex": search, "$options": "i"}}
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
        {'_id': 0, 'id': 1, 'nombre': 1, 'precio_unitario': 1, 'image_url': 1, 'categoria': 1}
    ).sort('nombre', 1).to_list(500)
    
    return [ProductoCatalogo(**p) for p in productos]

@public_router.get("/public/cliente/{dni}", response_model=ClientePublico)
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
    if not user_data.get('preferencias', {}).get('autoLogout', False):
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
        timestamp=user['timestamp']
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
async def get_preferencias(current_user: Usuario = Depends(get_current_user)):
    """Obtener las preferencias del usuario actual"""
    return current_user.preferencias or {'showCents': True}

@api_router.put("/auth/preferencias")
async def update_preferencias(
    preferencias: PreferenciasUpdate, 
    current_user: Usuario = Depends(get_current_user)
):
    """Actualizar preferencias del usuario actual"""
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
    
    # Guardar en la base de datos
    result = await db.usuarios.update_one(
        {'id': current_user.id},
        {'$set': {'preferencias': preferencias_actuales}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Error al actualizar preferencias")
    
    return {"message": "Preferencias actualizadas exitosamente", "preferencias": preferencias_actuales}

@api_router.get("/auth/login-registros")
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
        ahora_local = ahora_utc.astimezone()
        
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
    
    # Asegurar que precio_costo esté presente
    producto_data = input.model_dump()
    if 'precio_costo' not in producto_data or producto_data['precio_costo'] is None:
        producto_data['precio_costo'] = 0.0
    
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
async def get_producto(producto_id: str, current_user: Usuario = Depends(get_current_user)):
    producto = await db.productos.find_one({'id': producto_id}, {'_id': 0})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if isinstance(producto.get('timestamp'), str):
        producto['timestamp'] = datetime.fromisoformat(producto['timestamp'])
    
    return Producto(**producto)

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
    
    # Guardar valores anteriores
    valores_anteriores = {
        'nombre': producto.get('nombre'),
        'precio_unitario': producto.get('precio_unitario'),
        'stock': producto.get('stock'),
        'descuento_cantidad_minima': producto.get('descuento_cantidad_minima'),
        'descuento_precio_unitario': producto.get('descuento_precio_unitario')
    }
    
    # Obtener todos los datos del input excepto los que son None
    input_data = input.model_dump()
    print(f"DEBUG input_data: {input_data}")
    update_data = {k: v for k, v in input_data.items() if v is not None}
    print(f"DEBUG update_data before force: {update_data}")
    
    # Forzar precio_costo si viene en el payload (inclusive si es 0)
    if 'precio_costo' in input_data:
        update_data['precio_costo'] = input_data['precio_costo']
    
    print(f"DEBUG update_data after force: {update_data}")
    
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
async def create_venta(input: VentaCreate, current_user: Usuario = Depends(get_current_user)):
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
            else:
                nuevo_stock = producto.get('stock', 0) - detalle['cantidad']
                await db.productos.update_one(
                    {'id': detalle['producto_id']},
                    {'$set': {'stock': nuevo_stock}}
                )
    
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

@api_router.get("/ventas")
async def get_ventas(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    fecha_inicio: str = Query(None),
    fecha_fin: str = Query(None),
    metodo_pago: str = Query(None),
    usuario_id: str = Query(None),
    cliente_id: str = Query(None),
    agrupar_por_dia: bool = Query(False),
    current_user: Usuario = Depends(get_current_user)
):
    solo_mis_datos = current_user.preferencias.get('soloMisDatos', False) if current_user.preferencias else False
    
    match_stage = {}
    
    if solo_mis_datos:
        match_stage['usuario_id'] = current_user.id
    elif usuario_id:
        match_stage['usuario_id'] = usuario_id
    
    if cliente_id:
        match_stage['cliente_id'] = cliente_id
    
    if metodo_pago:
        match_stage['$or'] = [
            {'medio_pago': metodo_pago},
            {'pagos.medio_pago': metodo_pago}
        ]
    
    if fecha_inicio or fecha_fin:
        match_stage['fecha'] = {}
        if fecha_inicio:
            match_stage['fecha']['$gte'] = fecha_inicio
        if fecha_fin:
            match_stage['fecha']['$lte'] = fecha_fin + 'T23:59:59'
    
    if agrupar_por_dia:
        pipeline = [
            {"$match": match_stage},
            {
                "$addFields": {
                    "fecha_str": {
                        "$cond": {
                            "if": {"$eq": [{"$type": "$fecha"}, "string"]},
                            "then": "$fecha",
                            "else": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$fecha"}}
                        }
                    }
                }
            },
            {"$project": {"_id": 0}},
            {
                "$group": {
                    "_id": {"$substr": ["$fecha_str", 0, 10]},
                    "ventas": {"$push": "$$ROOT"},
                    "total_bruto": {"$sum": "$total"},
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
            {
                "$addFields": {
                    "fecha_str": {
                        "$cond": {
                            "if": {"$eq": [{"$type": "$fecha"}, "string"]},
                            "then": "$fecha",
                            "else": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$fecha"}}
                        }
                    }
                }
            },
            {
                "$group": {
                    "_id": {"$substr": ["$fecha_str", 0, 10]}
                }
            },
            {"$count": "total_dias"}
        ]
        count_cursor = db.ventas.aggregate(count_pipeline)
        count_result = await count_cursor.to_list(1)
        total_dias = count_result[0]['total_dias'] if count_result else 0
        
        stats_pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": None,
                    "total_bruto": {"$sum": "$total"},
                    "total_neto": {"$sum": {"$ifNull": ["$ganancia_neta", 0]}},
                    "dias_unicos": {"$addToSet": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$fecha"}
                    }}
                }
            }
        ]
        stats_pipeline = [
            {"$match": match_stage},
            {
                "$addFields": {
                    "fecha_str": {
                        "$cond": {
                            "if": {"$eq": [{"$type": "$fecha"}, "string"]},
                            "then": "$fecha",
                            "else": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$fecha"}}
                        }
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_bruto": {"$sum": "$total"},
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
            promedio_diario = total_bruto / dias_unicos if dias_unicos > 0 else 0
        else:
            total_bruto = 0
            total_neto = 0
            dias_unicos = 0
            promedio_diario = 0
        
        ventas_result = []
        for grupo in resultados:
            fecha_iso = datetime.fromisoformat(grupo['_id'])
            for v in grupo.get('ventas', []):
                if isinstance(v.get('fecha'), str):
                    v['fecha'] = datetime.fromisoformat(v['fecha'])
            ventas_result.extend(grupo.get('ventas', []))
        
        return {
            "ventas": ventas_result,
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
                "cantidad_ventas": sum(g.get('cantidad_ventas', 0) for g in resultados)
            }
        }
    else:
        pipeline = [
            {"$match": match_stage},
            {"$project": {"_id": 0}},
            {"$sort": {"fecha": -1}},
            {"$skip": (page - 1) * limit},
            {"$limit": limit}
        ]
        
        cursor = db.ventas.aggregate(pipeline)
        ventas_paginadas = await cursor.to_list(limit)
        
        total_count = await db.ventas.count_documents(match_stage)
        
        stats_pipeline = [
            {"$match": match_stage},
            {
                "$addFields": {
                    "fecha_str": {
                        "$cond": {
                            "if": {"$eq": [{"$type": "$fecha"}, "string"]},
                            "then": "$fecha",
                            "else": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$fecha"}}
                        }
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_bruto": {"$sum": "$total"},
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

@api_router.get("/ventas/{venta_id}", response_model=Venta)
async def get_venta(venta_id: str, current_user: Usuario = Depends(get_current_user)):
    venta = await db.ventas.find_one({'id': venta_id}, {'_id': 0})
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    
    if isinstance(venta.get('fecha'), str):
        venta['fecha'] = datetime.fromisoformat(venta['fecha'])
    
    return Venta(**venta)

# ===== DASHBOARD ROUTES =====

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: Usuario = Depends(get_current_user)):
    # Verificar si el usuario quiere solo sus datos
    solo_mis_datos = current_user.preferencias.get('soloMisDatos', False) if current_user.preferencias else False
    
    # Obtener fecha actual en UTC para coincidir con cómo se guardan los datos
    ahora_utc = datetime.now(timezone.utc)
    # Convertir a fecha local para obtener el día correcto en la zona horaria local
    ahora_local = ahora_utc.astimezone()
    
    # Crear rangos del día en UTC para comparación con base de datos
    hoy_inicio_utc = ahora_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    hoy_fin_utc = ahora_local.replace(hour=23, minute=59, second=59, microsecond=999999).astimezone(timezone.utc)
    
    hoy_inicio_str = hoy_inicio_utc.isoformat()
    hoy_fin_str = hoy_fin_utc.isoformat()
    
    # Filtro base para ventas y egresos
    filtro_fecha = {'fecha': {'$gte': hoy_inicio_str, '$lte': hoy_fin_str}}
    
    # Filtrar ventas del día actual (00:00:00 - 23:59:59)
    if solo_mis_datos:
        filtro_ventas = {**filtro_fecha, 'usuario_id': current_user.id}
    else:
        filtro_ventas = filtro_fecha
    
    ventas_hoy = await db.ventas.find(filtro_ventas, {'_id': 0}).to_list(1000)
    
    total_vendido = sum(v['total'] for v in ventas_hoy)
    cantidad_ventas = len(ventas_hoy)
    
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
    
    # Obtener saldo total de cuenta corriente
    clientes = await db.clientes.find({}, {'_id': 0}).to_list(1000)
    total_saldo_cuenta_corriente = 0
    
    for cliente in clientes:
        movimientos = await db.movimientos.find({'cliente_id': cliente['id']}, {'_id': 0}).to_list(1000)
        saldo_cliente = sum(m['monto'] for m in movimientos)
        total_saldo_cuenta_corriente += saldo_cliente
    
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
    
    # Obtener clientes con saldo (todos los que tienen movimientos)
    clientes = await db.clientes.find({}, {'_id': 0, 'id': 1, 'nombre': 1}).to_list(1000)
    ultimos_clientes = []
    for cliente in clientes:
        # Obtener el último movimiento de cada cliente usando find con sort y limit
        ultimo_mov_cursor = await db.movimientos.find(
            {'cliente_id': cliente['id']},
            {'_id': 0, 'fecha': 1}
        ).sort('fecha', -1).limit(1).to_list(1)
        
        if ultimo_mov_cursor:
            ultimo_mov = ultimo_mov_cursor[0]
            # Calcular saldo del cliente
            movimientos = await db.movimientos.find(
                {'cliente_id': cliente['id']},
                {'_id': 0, 'monto': 1}
            ).to_list(1000)
            saldo = sum(m['monto'] for m in movimientos)
            
            # Incluir todos los clientes con movimientos
            ultimos_clientes.append({
                'cliente_nombre': cliente['nombre'],
                'cliente_id': cliente['id'],
                'ultima_fecha': ultimo_mov.get('fecha'),
                'saldo': saldo
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
    productos = await db.productos.find({}, {'_id': 0}).to_list(1000)
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
    
    return DashboardStats(
        total_vendido_hoy=total_vendido,
        cantidad_ventas_hoy=cantidad_ventas,
        ventas_por_medio_pago=ventas_por_medio,
        total_saldo_cuenta_corriente=total_saldo_cuenta_corriente,
        total_egresos_hoy=total_egresos_hoy,
        ingresos_cta_cte_hoy=ingresos_cta_cte_hoy,
        ultimos_clientes_cta_cte=ultimos_clientes
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
async def get_egresos(current_user: Usuario = Depends(get_current_user)):
    egresos = await db.egresos.find({}, {'_id': 0}).sort('fecha', -1).to_list(1000)
    
    for e in egresos:
        if isinstance(e.get('fecha'), str):
            e['fecha'] = datetime.fromisoformat(e['fecha'])
    
    return egresos

@api_router.get("/egresos/{egreso_id}", response_model=Egreso)
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
async def get_usuarios_basicos(current_user: Usuario = Depends(get_current_user)):
    """Retorna lista básica de usuarios (id, nombre) para filtros - accesible para todos los usuarios autenticados"""
    usuarios = await db.usuarios.find({}, {'_id': 0, 'password': 0, 'rol': 0, 'timestamp': 0}).to_list(1000)
    return usuarios

# ===== ADMIN USUARIOS ROUTES =====

@api_router.get("/admin/usuarios", response_model=List[Usuario])
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
        await registrar_auditoria(
            entidad='usuario',
            entidad_id=usuario_id,
            entidad_nombre=usuario.get('nombre'),
            accion='modificado',
            valores_anteriores=valores_anteriores,
            valores_nuevos=update_data,
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
    usuario_a_eliminar = await db.usuarios.find_one({'id': usuario_id}, {'_id': 0})
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
async def obtener_sticky_notes(current_user: Usuario = Depends(get_current_user)):
    """Obtiene todas las sticky notes (visibles para todos)"""
    try:
        sticky_notes = []
        cursor = db["sticky_notes"].find().sort("fijada", -1).sort("timestamp", -1)
        
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
            
        return sticky_notes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener sticky notes: {str(e)}")

@api_router.put("/sticky-notes/{note_id}", response_model=StickyNote)
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
        
        async with httpx.AsyncClient() as client:
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
                    "payer_email": payment.get("payer", {}).get("email"),
                    "payer_identificacion": payment.get("payer", {}).get("identification", {}),
                })
        
        return {"transferencias": transferencias, "cantidad": len(transferencias), "busqueda_minutos": minutos}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== CONFIGURACIÓN MERCADOPAGO =====

@api_router.get("/mercadopago/configuracion")
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
async def limpiar_base_de_datos_direct():
    """Endpoint directo en app para limpieza"""
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
async def limpiar_test_sin_auth():
    """Endpoint de prueba sin autenticación"""
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
async def limpiar_auditoria_direct(request: Request):
    """Endpoint directo para limpiar auditoría (requiere auth en headers)"""
    try:
        # Extraer token del header
        auth_header = request.headers.get('authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {"error": "Se requiere autenticación"}
        
        token = auth_header.split(' ')[1]
        
        # Verificar token y obtener usuario
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            username = payload.get('sub')
            if not username:
                return {"error": "Token inválido"}
            
            user = await db.usuarios.find_one({'username': username}, {'_id': 0, 'password': 0})
            if not user or user.get('rol') != 'admin':
                return {"error": "Se requiere rol de administrador"}
        except:
            return {"error": "Token inválido o expirado"}
        
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
async def limpiar_login_registros_direct(request: Request):
    """Endpoint directo para limpiar registros de login (requiere auth en headers)"""
    try:
        # Extraer token del header
        auth_header = request.headers.get('authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {"error": "Se requiere autenticación"}
        
        token = auth_header.split(' ')[1]
        
        # Verificar token y obtener usuario
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            username = payload.get('sub')
            if not username:
                return {"error": "Token inválido"}
            
            user = await db.usuarios.find_one({'username': username}, {'_id': 0, 'password': 0})
            if not user or user.get('rol') != 'admin':
                return {"error": "Se requiere rol de administrador"}
        except:
            return {"error": "Token inválido o expirado"}
        
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
    
    # LIMPIEZA FORZADA DE ÍNDICES CONFLICTIVOS
    # Auditoría: eliminar todos los índices excepto _id
    try:
        await db.auditoria.drop_indexes()
        print("Todos los índices de auditoria eliminados")
    except Exception as e:
        print(f"Error eliminando índices de auditoria: {e}")
    
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

app.add_middleware(SecurityMiddleware)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()