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
- **Radix UI**: Componentes accesibles y personalizables
- **React Hook Form**: Formularios optimizados con Zod validation
- **Axios**: Cliente HTTP para comunicación con API
- **Recharts**: Visualización de datos y gráficos
- **Lucide React**: Iconos modernos y consistentes

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
│   │   ├── pages/         # Páginas principales
│   │   ├── hooks/         # Hooks personalizados
│   │   ├── lib/           # Utilidades y helpers
│   │   └── context/       # Contextos de React
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
- **Type Safety**: TypeScript en frontend, type hints en Python
- **Responsive Design**: Interfaz adaptable a todos los dispositivos
- **Real-time Updates**: Actualizaciones en tiempo real del dashboard
- **Scalability**: Arquitectura preparada para escalabilidad horizontal
- **Performance**: Optimizado con paginación, caching y consultas eficientes

## 🎯 Ideal Para

- Vinotecas y licorerías
- Negocios de bebidas especializadas
- Pequeños y medianos comercios
- Empresas con sistema de cuenta corriente
- Negocios que requieren control de stock avanzado

## 👥 Contribuidores

Gracias a todas las personas que han contribuido a hacer de VinoPorMi un proyecto mejor:

### Maintainers

- **[Your Name](https://github.com/yourusername)** - Fundador y desarrollador principal

### Contribuidores

<!-- 
Contribuidores son automáticamente agregados por GitHub
Puedes agregar manualmente contribuidores especiales aquí si lo deseas
-->

[![Contributors](https://contrib.rocks/image?repo=yourusername/vinopormi)](https://github.com/yourusername/vinopormi/graphs/contributors)

### Cómo Contribuir

¿Quieres ser parte de este proyecto? 🎉

1. **Revisa nuestra [Guía de Contribución](CONTRIBUTING.md)**
2. **Lee nuestro [Código de Conducta](CODE_OF_CONDUCT.md)**
3. **Busca issues con la etiqueta `good first issue`**
4. **Participa en nuestras [Discusiones](https://github.com/yourusername/vinopormi/discussions)**

### Tipos de Contribuciones

- 🐛 **Reporte de bugs** - Ayúdanos a encontrar y solucionar errores
- 💡 **Nuevas ideas** - Sugiere mejoras y funcionalidades
- 📖 **Documentación** - Mejora la documentación del proyecto
- 🌍 **Traducciones** - Ayuda a traducir el proyecto a otros idiomas
- 🎨 **Diseño** - Contribuye al diseño UI/UX
- 🧪 **Testing** - Ayuda a mejorar la cobertura de pruebas

### Reconocimientos

- Los contribuidores activos son reconocidos en cada release
- Las contribuciones significativas son destacadas en el README
- Los maintainers del proyecto son invitados basados en sus contribuciones

---

## 📄 Licencia

Este proyecto está licenciado bajo la [MIT License](LICENSE).

---

**Desarrollado con ❤️ para la comunidad de vinos**