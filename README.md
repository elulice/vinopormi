# VinoPorMi - Sistema de Gestión de Vinoteca

🍷 **VinoPorMi** es un sistema integral de gestión moderno para vinotecas y negocios de bebidas, desarrollado con arquitectura full-stack para optimizar el control completo del negocio: inventario, ventas, clientes, proveedores y finanzas.

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

## 🛠️ Arquitectura y Tecnologías

### Backend
- **FastAPI**: Framework moderno y asíncrono para APIs Python
- **MongoDB**: Base de datos NoSQL con Motor (async driver)
- **Pydantic**: Validación y serialización de datos
- **JWT**: Autenticación con tokens JSON Web Tokens
- **bcrypt**: Encriptación segura de contraseñas
- **Rate Limiting**: Protección contra abusos con SlowAPI

### Frontend
- **React 18**: Biblioteca moderna de JavaScript con hooks
- **React Router**: Navegación y routing de SPA
- **Tailwind CSS**: Framework de CSS utility-first
- **Radix UI**: Componentes accesibles y personalizables (selección optimizada)
- **Axios**: Cliente HTTP para comunicación con API
- **Lucide React**: Iconos modernos y consistentes
- **Date-fns**: Manipulación y formateo de fechas
- **Sonner**: Sistema de notificaciones toast
- **Vaul**: Componentes de drawer animados

### Infraestructura y DevOps
- **Node.js**: Entorno de ejecución JavaScript (v24.x)
- **Yarn**: Gestor de paquetes optimizado
- **CRACO**: Configuración avanzada de Create React App
- **Python 3.11+**: Backend con soporte async/await
- **UVicorn**: Servidor ASGI de alto rendimiento

## 📁 Estructura del Proyecto

```
vinopormi/
├── backend/                 # API FastAPI
│   ├── server.py           # Servidor principal y endpoints
│   ├── requirements.txt    # Dependencias Python
│   └── .env               # Variables de entorno
├── frontend/               # Aplicación React
│   ├── src/
│   │   ├── components/     # Componentes UI reutilizables
│   │   │   ├── ui/        # Componentes UI base (optimizado)
│   │   │   ├── FloatingMenu.js
│   │   │   ├── Layout.js
│   │   │   ├── ResponsiveTable.js
│   │   │   └── StickyNotesContainer.js
│   │   ├── pages/         # Páginas principales
│   │   │   ├── Dashboard.js
│   │   │   ├── Productos.js
│   │   │   ├── Ventas.js
│   │   │   ├── Clientes.js
│   │   │   ├── Proveedores.js
│   │   │   ├── Egresos.js
│   │   │   ├── Usuarios.js
│   │   │   └── Más...
│   │   ├── hooks/         # Hooks personalizados
│   │   │   ├── useDebounce.js
│   │   │   └── use-toast.js
│   │   ├── lib/           # Utilidades y helpers
│   │   │   ├── currency.js
│   │   │   └── utils.js
│   │   ├── context/       # Contextos de React
│   │   │   ├── AuthContext.js
│   │   │   └── ConfigContext.js
│   │   └── assets/        # Imágenes y recursos
│   ├── package.json       # Dependencias Node.js (optimizado)
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

## 🔐 Seguridad

- Autenticación JWT con expiración configurable
- Encriptación de contraseñas con bcrypt
- Rate limiting en endpoints críticos
- Validación de datos con Pydantic/Zod
- Registro de auditoría completo
- Protección CORS configurada

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
pip install -r requirements.txt
uvicorn server:app --reload
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

**Nota:** El proyecto ha sido optimizado recientemente, eliminando dependencias y componentes no utilizados para mejorar el rendimiento y reducir el tamaño del bundle.

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
  - Optimizado con paginación, caching y consultas eficientes
  - Bundle size reducido (~175 kB gzipped)
  - Dependencias optimizadas (eliminadas 43 paquetes no utilizados)
  - Componentes UI optimizados (solo 8 componentes esenciales)

## 🎯 Ideal Para

- Vinotecas y licorerías
- Negocios de bebidas especializadas
- Pequeños y medianos comercios
- Empresas con sistema de cuenta corriente
- Negocios que requieren control de stock avanzado

---

## 📄 Licencia

Este proyecto está licenciado bajo la [MIT License](LICENSE).

## 🔄 Actualizaciones Recientes (Última Optimización)

### ✅ Optimización de Código y Dependencias
- **Eliminadas 6 dependencias principales**: `recharts`, `react-window`, `react-window-infinite-loader`, `@hookform/resolvers`, `zod`, `input-otp`
- **Removidos 43 paquetes totales** incluyendo dependencias Radix UI no utilizadas
- **Limpiados 33 componentes UI** que no tenían referencias en el código
- **Bundle size optimizado**: Reducción significativa del tamaño final
- **Build sin warnings**: Corregidos todos los warnings de ESLint

### 🧹 Limpieza de Código
- Eliminados imports sin uso (`Edit` de FloatingMenu.js)
- Removido código muerto y espacios vacíos innecesarios
- Verificadas y corregidas referencias a assets
- Estructura de componentes UI simplificada y optimizada

### 📊 Impacto en Rendimiento
- **Tiempo de construcción mejorado**
- **Consumo de memoria reducido** 
- **Carga inicial más rápida**
- **Mantenimiento simplificado**

---

**Desarrollado con ❤️ para la comunidad de vinos**