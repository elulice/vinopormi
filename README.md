
# VinoPorMi - Sistema de Gestión de Vinoteca

🍷 **VinoPorMi** es un sistema integral de gestión moderno para vinotecas y negocios medianos, desarrollado con arquitectura full-stack para optimizar el control completo del negocio: inventario, ventas, clientes, proveedores y finanzas.

Una solución web responsiva que combina la potencia de FastAPI + MongoDB en el backend con React + Tailwind CSS en el frontend, ofreciendo una experiencia de usuario fluida y herramientas administrativas robustas.

## 🚀 Características Principales

### Gestión Comercial
- **Control de Stock**: Gestión completa de productos con alertas de bajo stock
- **Ventas**: Proceso de ventas con múltiples medios de pago (efectivo, tarjeta, cuenta corriente)
- **Clientes**: Base de datos de clientes con cuenta corriente integrada
- **Proveedores**: Gestión de proveedores con control de cuentas a pagar

### Administración
- **Usuarios**: Sistema de roles (administrador/común) con autenticación JWT
- **Auditoría**: Registro completo de todas las acciones del sistema
- **Dashboard**: Estadísticas en tiempo real de ventas y métricas clave
- **Egresos**: Control de gastos y categorización

### Funcionalidades Avanzadas
- **Cuenta Corriente**: Sistema de crédito para clientes y proveedores
- **Notificaciones**: Alertas automáticas de bajo stock
- **Registros de Login**: Control de accesos y seguridad
- **Herramientas Administrativas**: Utilidades de gestión avanzada
- **Recomendaciones**: Módulo inteligente por reglas que analiza la velocidad de venta para sugerir reposición y detectar exceso de stock
- **Modo Offline / Sincronización automática**: Almacenamiento local con Dexie (IndexedDB) para ventas y egresos sin conexión, con sincronización automática al restaurarse la conectividad
- **Chat IA**: Consultas en lenguaje natural sobre ventas, productos, cuentas corrientes, egresos, MercadoPago y auditoría, con historial por usuario, dictado por voz y respuestas en Markdown. Solo lectura.
- **Categorías de productos**: Crear, editar y eliminar categorías desde Productos; al renombrar una categoría se actualizan los productos asociados.
- **Novedades**: Modal versionado gestionado desde el backend/base de datos, con seguimiento de lo ya visto por versión en el navegador.
- **Preferencias configurables**: Elementos del sidebar y acciones del menú flotante configurables por usuario, con opción de mostrar/ocultar cada una.
- **Actualización automática**: Service Worker con recarga automática al desplegar una nueva versión (sin CTRL+F5).

## 🛠️ Arquitectura y Tecnologías

### Backend
- **FastAPI**,  **MongoDB**, **Pydantic**, **JWT**, **bcrypt**, **Rate Limiting**

### Frontend
- **React 18**, **React Router**, **Tailwind CSS**, **Radix UI**, **Axios**, **Lucide React**, **Date-fns**, **Sonner**, **Vaul**

### Infraestructura y DevOps
- **Node.js**, **Yarn**, **CRACO**, **Python 3.11+**, **UVicorn**, **nginx** (reverse proxy + HTTPS), **DDNS**, **Service Worker**, **Health Check Plugin**

## 📁 Estructura del Proyecto

```
vinopormi/
├── backend/                # API FastAPI
│   ├── server.py           # Servidor principal y endpoints
│   ├── ai_chat.py          # Herramientas y lógica del Chat IA (solo lectura)
│   ├── recommendations.py  # Módulo de recomendaciones por velocidad de venta
│   ├── check_tipos.py      # Utilidad de verificación de tipos
│   ├── test_recomendaciones.py # Tests del módulo de recomendaciones
│   ├── requirements.txt    # Dependencias Python
│   ├── .env.example        # Plantilla de variables de entorno (no subir .env real)
│   └── .env                # Variables de entorno (ignorado por Git)
├── frontend/               # Aplicación React
│   ├── src/
│   │   ├── components/    # Componentes UI reutilizables
│   │   │   ├── ui/        # Componentes UI base (shadcn/ui)
│   │   │   ├── common/    # Componentes comunes reutilizables
│   │   │   ├── BackgroundSync.jsx # Sincronización offline con Dexie
│   │   │   ├── AutoUpdater.jsx    # Detección y recarga automática de nuevas versiones
│   │   │   ├── WelcomeModal.jsx   # Modal de novedades (datos del backend)
│   │   │   ├── Layout.js
│   │   │   ├── FloatingMenu.js
│   │   │   ├── ResponsiveTable.js
│   │   │   └── StickyNotesContainer.js
│   │   ├── pages/         # Páginas principales
│   │   │   ├── Dashboard.js, Productos.js, Ventas.js, NuevaVenta.js
│   │   │   ├── Clientes.js, Proveedores.js, Egresos.js, Usuarios.js
│   │   │   ├── Recomendaciones.js, Auditoria.js, Configuracion.js
│   │   │   ├── Herramientas.js, LoginRegistros.js, Mercadopago.js
│   │   │   ├── PaginaCatalogo.js, SeccionClientes.js
│   │   │   ├── ChatIA.js
│   │   │   └── LandingPage.js, Login.js
│   │   ├── hooks/         # Hooks personalizados
│   │   │   ├── useDebounce.js
│   │   │   └── use-toast.js
│   │   ├── lib/           # Utilidades y helpers
│   │   │   ├── api.js, config.js, currency.js, downloadUtils.js, utils.js
│   │   ├── context/       # Contextos de React
│   │   │   ├── AuthContext.js
│   │   │   └── ConfigContext.js
│   │   ├── db/            # Configuración Dexie (IndexedDB) para modo offline
│   │   └── assets/        # Imágenes y recursos
│   ├── plugins/           # Plugins custom de webpack (health-check)
│   ├── craco.config.js    # Configuración CRACO
│   ├── package.json       # Dependencias Node.js
│   └── tailwind.config.js # Configuración Tailwind
└── README.md              # Este archivo
```

## 🏗️ Modelo de Datos

### Entidades Principales
- **Productos**: Nombre, precio, stock, descuentos por cantidad
- **Clientes**: Datos de contacto, saldo de cuenta corriente
- **Proveedores**: Información de proveedores, cuentas a pagar
- **Ventas**: Transacciones con detalles y medios de pago
- **Usuarios**: Roles y permisos del sistema
- **Auditoría**: Traza completa de acciones
- **Sincronización Offline**: Cola de ventas y egresos pendientes con sincronización automática (Dexie + IndexedDB)

## 🔐 Seguridad

- Autenticación JWT con expiración configurable (firma mediante `JWT_SECRET`)
- Encriptación de contraseñas con bcrypt
- Rate limiting en endpoints de autenticación
- Validación de datos con Pydantic
- Registro de auditoría completo
- Protección CORS configurable mediante `CORS_ORIGINS`

## 📊 Dashboard y Métricas

- Ventas del día y totales
- Distribución por medios de pago
- Saldos de cuenta corriente
- Egresos del día
- Alertas de bajo stock
- Estadísticas en tiempo real

## 🚀 Instalación y Ejecución

### Backend
```bash
cd backend
cp .env.example .env   # en Windows: copy .env.example .env
# Editar .env: MONGO_URL, DB_NAME, JWT_SECRET, CORS_ORIGINS, GROQ_API_KEY
pip install -r requirements.txt
uvicorn server:app --reload --host 127.0.0.1 --port 8001
```

Configurá `JWT_SECRET` con un valor propio: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
El frontend de desarrollo usa `REACT_APP_BACKEND_URL=http://localhost:8001` en `frontend/.env.development`.

### Frontend
```bash
cd frontend
yarn install
yarn start
```

## 🌐 API Endpoints

La API expone endpoints RESTful para:
- Autenticación (`/api/auth/`)
- Productos (`/api/productos/`)
- Clientes (`/api/clientes/`)
- Ventas (`/api/ventas/`)
- Dashboard (`/api/dashboard/`)
- Auditoría (`/api/auditoria/`)
- Y más...

## 📈 Características Técnicas

- **Asincronía**: Backend completamente async con FastAPI
- **Type Safety**: Type hints en Python, JavaScript moderno en frontend
- **Responsive Design**: Interfaz adaptable a todos los dispositivos
- **Real-time Updates**: Actualizaciones en tiempo real del dashboard
- **Scalability**: Arquitectura preparada para escalabilidad horizontal
- **Performance**:
  - Paginación y consultas optimizadas en los listados principales
  - Service Worker con precache de assets en producción
  - Componentes UI optimizados

## 🎯 Ideal Para

- Vinotecas y licorerías
- Pequeños y medianos comercios
- Empresas con sistema de cuenta corriente
- Negocios que requieren control de stock avanzado

---

## 📄 Licencia

Este proyecto está licenciado bajo la licencia MIT.

---

**Desarrollado con ❤️ para la comunidad**
