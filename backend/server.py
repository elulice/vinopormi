from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
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
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")
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
    preferencias: dict = Field(default_factory=lambda: {"showCents": True, "sidebarWidth": "normal", "floatingMenu": False})  # Preferencias del usuario
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: Usuario

class Producto(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    precio_unitario: float
    stock: int = 0
    # Descuento por cantidad (opcional)
    descuento_cantidad_minima: Optional[int] = None  # Cantidad mínima para descuento
    descuento_precio_unitario: Optional[float] = None  # Precio unitario con descuento
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductoCreate(BaseModel):
    nombre: str
    precio_unitario: float
    stock: Optional[int] = 0
    # Descuento por cantidad (opcional)
    descuento_cantidad_minima: Optional[int] = None
    descuento_precio_unitario: Optional[float] = None

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    precio_unitario: Optional[float] = None
    stock: Optional[int] = None
    # Descuento por cantidad (opcional)
    descuento_cantidad_minima: Optional[int] = None
    descuento_precio_unitario: Optional[float] = None

class Cliente(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClienteCreate(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None

class DetalleVenta(BaseModel):
    producto_id: str
    producto_nombre: str
    cantidad: int
    precio_unitario: float
    subtotal: float

class Venta(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total: float
    medio_pago: str
    cliente_id: Optional[str] = None
    cliente_nombre: Optional[str] = None
    usuario_id: Optional[str] = None
    usuario_nombre: Optional[str] = None
    detalles: List[DetalleVenta]

class VentaCreate(BaseModel):
    medio_pago: str
    cliente_id: Optional[str] = None
    detalles: List[DetalleVenta]

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

class DashboardStats(BaseModel):
    total_vendido_hoy: float
    cantidad_ventas_hoy: int
    ventas_por_medio_pago: dict
    total_saldo_cuenta_corriente: float
    total_egresos_hoy: float

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

class EgresoCreate(BaseModel):
    descripcion: str
    monto: float
    categoria: str

class EgresoUpdate(BaseModel):
    descripcion: Optional[str] = None
    monto: Optional[float] = None
    categoria: Optional[str] = None

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
    
    # Guardar en la base de datos
    result = await db.usuarios.update_one(
        {'id': current_user.id},
        {'$set': {'preferencias': preferencias_actuales}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Error al actualizar preferencias")
    
    return {"message": "Preferencias actualizadas exitosamente", "preferencias": preferencias_actuales}

@api_router.get("/auth/login-registros", response_model=List[dict])
async def get_login_registros(current_user: Usuario = Depends(get_current_user)):
    # Solo administradores pueden ver los registros de login
    if current_user.rol != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos para ver los registros de login")
    
    registros = await db.login_registros.find({}, {'_id': 0}).sort('fecha', -1).to_list(1000)
    
    for r in registros:
        if isinstance(r.get('fecha'), str):
            r['fecha'] = datetime.fromisoformat(r['fecha'])
    
    return registros

@api_router.get("/auditoria", response_model=List[RegistroAuditoria])
async def get_auditoria(
    request: Request,
    current_user: Usuario = Depends(get_current_user)
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
        filtro['accion'] = accion
    
    if fechaDesde:
        try:
            fechaDesde_dt = datetime.fromisoformat(fechaDesde)
            filtro['fecha'] = {'$gte': fechaDesde_dt}
        except ValueError:
            pass
    
    if fechaHasta:
        try:
            fechaHasta_dt = datetime.fromisoformat(fechaHasta)
            if '$gte' in filtro.get('fecha', {}):
                filtro['fecha']['$lte'] = fechaHasta_dt
            else:
                filtro['fecha'] = {'$lte': fechaHasta_dt}
        except ValueError:
            pass
    
    if search:
        filtro['$or'] = [
            {'entidad_nombre': {'$regex': search, '$options': 'i'}},
            {'entidad_id': {'$regex': search, '$options': 'i'}},
            {'valores_nuevos.nombre': {'$regex': search, '$options': 'i'}},
            {'valores_nuevos.username': {'$regex': search, '$options': 'i'}}
        ]
    
    # Obtener registros
    registros = await db.auditoria.find(filtro, {'_id': 0}).sort('fecha', -1).to_list(1000)
    
    # Convertir fechas string a datetime
    for r in registros:
        if isinstance(r.get('fecha'), str):
            r['fecha'] = datetime.fromisoformat(r['fecha'])
    
    return registros

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
    
    producto_obj = Producto(**input.model_dump())
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
    search: str = None
):
    """Endpoint optimizado con paginación y búsqueda"""
    try:
        skip = (page - 1) * limit
        filter_query = {}
        
        # Búsqueda optimizada - buscar palabras individuales
        if search:
            # Dividir la búsqueda en términos individuales
            search_terms = search.split()
            if len(search_terms) > 1:
                # Búsqueda múltiple: todos los términos deben estar presentes
                regex_patterns = [{"nombre": {"$regex": term, "$options": "i"}} for term in search_terms]
                filter_query = {"$and": regex_patterns}
            else:
                # Búsqueda simple para un solo término
                filter_query = {
                    "nombre": {"$regex": search, "$options": "i"}
                }
        
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
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
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

# ===== CLIENTES ROUTES =====

@api_router.post("/clientes", response_model=Cliente)
async def create_cliente(
    request: Request,
    input: ClienteCreate, 
    current_user: Usuario = Depends(get_current_user)
):
    cliente_obj = Cliente(**input.model_dump())
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
    
    # Guardar valores anteriores
    valores_anteriores = {
        'nombre': cliente.get('nombre'),
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
    # Unificar detalles por producto_id
    detalles_unificados = {}
    for detalle in input.detalles:
        if detalle.producto_id in detalles_unificados:
            detalles_unificados[detalle.producto_id]['cantidad'] += detalle.cantidad
            detalles_unificados[detalle.producto_id]['subtotal'] += detalle.subtotal
        else:
            detalles_unificados[detalle.producto_id] = {
                'producto_id': detalle.producto_id,
                'producto_nombre': detalle.producto_nombre,
                'cantidad': detalle.cantidad,
                'precio_unitario': detalle.precio_unitario,
                'subtotal': detalle.subtotal
            }
    
    detalles_finales = list(detalles_unificados.values())
    total = sum(d['subtotal'] for d in detalles_finales)
    
    cliente_nombre = None
    if input.cliente_id:
        cliente = await db.clientes.find_one({'id': input.cliente_id}, {'_id': 0})
        if cliente:
            cliente_nombre = cliente['nombre']
    
    venta_obj = Venta(
        total=total,
        medio_pago=input.medio_pago,
        cliente_id=input.cliente_id,
        cliente_nombre=cliente_nombre,
        usuario_id=current_user.id,
        usuario_nombre=current_user.nombre,
        detalles=[DetalleVenta(**d) for d in detalles_finales]
    )
    
    doc = venta_obj.model_dump()
    doc['fecha'] = doc['fecha'].isoformat()
    
    await db.ventas.insert_one(doc)
    
    for detalle in detalles_finales:
        producto = await db.productos.find_one({'id': detalle['producto_id']})
        if producto:
            nuevo_stock = producto['stock'] - detalle['cantidad']
            await db.productos.update_one(
                {'id': detalle['producto_id']},
                {'$set': {'stock': nuevo_stock}}
            )
    
    if input.medio_pago == 'cuenta_corriente' and input.cliente_id:
        movimiento = MovimientoCuentaCorriente(
            cliente_id=input.cliente_id,
            concepto=f"Venta #{venta_obj.id[:8]}",
            monto=-total,
            venta_id=venta_obj.id,  # Guardar el ID completo
            usuario_id=current_user.id,
            usuario_nombre=current_user.nombre
        )
        mov_doc = movimiento.model_dump()
        mov_doc['fecha'] = mov_doc['fecha'].isoformat()
        await db.movimientos.insert_one(mov_doc)
    
    return venta_obj

@api_router.get("/ventas", response_model=List[Venta])
async def get_ventas(current_user: Usuario = Depends(get_current_user)):
    ventas = await db.ventas.find({}, {'_id': 0}).sort('fecha', -1).to_list(1000)
    
    for v in ventas:
        if isinstance(v.get('fecha'), str):
            v['fecha'] = datetime.fromisoformat(v['fecha'])
    
    return ventas

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
    # Obtener fecha actual en UTC para coincidir con cómo se guardan los datos
    ahora_utc = datetime.now(timezone.utc)
    # Convertir a fecha local para obtener el día correcto en la zona horaria local
    ahora_local = ahora_utc.astimezone()
    
    # Crear rangos del día en UTC para comparación con base de datos
    hoy_inicio_utc = ahora_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    hoy_fin_utc = ahora_local.replace(hour=23, minute=59, second=59, microsecond=999999).astimezone(timezone.utc)
    
    hoy_inicio_str = hoy_inicio_utc.isoformat()
    hoy_fin_str = hoy_fin_utc.isoformat()
    
    # Filtrar ventas del día actual (00:00:00 - 23:59:59)
    ventas_hoy = await db.ventas.find({
        'fecha': {'$gte': hoy_inicio_str, '$lte': hoy_fin_str}
    }, {'_id': 0}).to_list(1000)
    
    total_vendido = sum(v['total'] for v in ventas_hoy)
    cantidad_ventas = len(ventas_hoy)
    
    ventas_por_medio = {}
    for venta in ventas_hoy:
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
    egresos_hoy = await db.egresos.find({
        'fecha': {'$gte': hoy_inicio_str, '$lte': hoy_fin_str}
    }, {'_id': 0}).to_list(1000)
    total_egresos_hoy = sum(e['monto'] for e in egresos_hoy)
    
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
        total_egresos_hoy=total_egresos_hoy
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
    
    return CuentaCorrienteInfo(
        cliente=Cliente(**cliente),
        saldo=saldo,
        movimientos=[MovimientoCuentaCorriente(**m) for m in movimientos]
    )

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
    egreso_obj = Egreso(**input.model_dump())
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

app.include_router(api_router)
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
        
        # Limpiar auditoría
        resultado = await db.auditoria.delete_many({})
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
    try:
        # Índice único en nombre de producto
        await db.productos.create_index("nombre", unique=True)
        
        # Índice de texto para búsquedas difusas
        await db.productos.create_index([("nombre", "text")])
        

        
        # Índice para paginación por nombre
        await db.productos.create_index([("nombre", 1), ("_id", 1)])
        
        print("Indices creados exitosamente para productos")
    except Exception as e:
        print(f"Error creando indices: {e}")

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