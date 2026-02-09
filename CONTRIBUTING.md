# Contributing to VinoPorMi 🍷

¡Gracias por tu interés en contribuir a VinoPorMi! Este documento te guiará sobre cómo puedes colaborar con el proyecto.

## 🤝 Cómo Contribuir

### Reportando Bugs
Si encuentras un bug, por favor:
1. Busca si ya existe un issue abierto
2. Si no existe, crea un nuevo issue usando la plantilla de bug report
3. Proporciona toda la información posible para reproducir el problema

### Sugeriendo Mejoras
- Usa la plantilla de feature request para nuevas funcionalidades
- Sé específico sobre el problema que resuelve tu sugerencia
- Considera si la mejora beneficia a la mayoría de usuarios

### Contribuciones de Código
1. **Fork** el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. **Commits** descriptivos (ver sección de estándares)
4. **Push** a tu fork (`git push origin feature/nueva-funcionalidad`)
5. Crea un **Pull Request**

## 📝 Estándares de Código

### Python (Backend)
- Usa **type hints** en todas las funciones
- Sigue las convenciones de **PEP 8**
- Documenta funciones con docstrings
- Usa **async/await** para operaciones I/O

```python
# ✅ Buen ejemplo
async def create_producto(
    request: Request,
    input: ProductoCreate, 
    current_user: Usuario = Depends(get_current_user)
) -> Producto:
    """Crea un nuevo producto en el sistema."""
    # Implementación...
```

### JavaScript/TypeScript (Frontend)
- Usa **nombres descriptivos** para variables y funciones
- Sigue el patrón de **componentes funcionales** con hooks
- Usa **Tailwind CSS** para estilos
- Proporciona **tipos** cuando sea posible

```javascript
// ✅ Buen ejemplo
const ProductosTable = ({ productos, onEdit, onDelete }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  // Implementación...
};
```

## 📋 Estándares de Commits

Usa el formato **Conventional Commits**:

```
<tipo>[ámbito opcional]: <descripción>

[opcional: cuerpo]

[opcional: pie de página]
```

### Tipos de Commits
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios en documentación
- `style`: Cambios de formato (no lógica)
- `refactor`: Refactorización de código
- `test`: Agregar o modificar tests
- `chore`: Tareas de mantenimiento

### Ejemplos
```
feat(auth): agregar sistema de roles de usuario

fix(productos): corregir validación de stock negativo

docs(api): actualizar documentación de endpoints

refactor(ventas): optimizar consulta de ventas paginadas
```

## 🧪 Testing

### Backend
- Agrega tests para nuevos endpoints
- Prueba casos límite y errores
- Usa **pytest** con fixtures

### Frontend
- Prueba componentes nuevos
- Verifica comportamiento en diferentes tamaños de pantalla
- Prueba flujos de usuario completos

## 🔄 Proceso de Pull Request

### Antes de Crear el PR
1. **Revisa** tu código:
   - ¿Sigue los estándares del proyecto?
   - ¿Hay comentarios donde sea necesario?
   - ¿Hay código muerto o comentado?

2. **Testing**:
   - Prueba manualmente tus cambios
   - Asegúrate de no romper funcionalidades existentes

3. **Documentación**:
   - Actualiza README si es necesario
   - Agrega comentarios a código complejo

### Estructura del PR
- **Título claro**: Describa el cambio principal
- **Descripción detallada**: ¿Por qué este cambio? ¿Qué resuelve?
- **Pasos para probar**: Cómo probar tus cambios
- **Screenshots**: Si hay cambios visuales

### Revisión
- Sé **paciente** durante el proceso de revisión
- Responde a los comentarios de forma constructiva
- Realiza los cambios solicitados

## 🏗️ Áreas del Proyecto

### Backend (FastAPI)
- **Endpoints**: Nuevas rutas de API
- **Models**: Esquemas de Pydantic
- **Database**: Nuevas colecciones o índices
- **Auth**: Mejoras de seguridad

### Frontend (React)
- **Components**: Componentes UI reutilizables
- **Pages**: Páginas principales
- **Hooks**: Lógica personalizada
- **Utils**: Funciones helper

### DevOps
- **Docker**: Contenerización
- **CI/CD**: Automatización
- **Testing**: Suites de prueba

## 📊 Etiquetas (Labels)

### Prioridad
- `priority: critical` - Bloquea el proyecto
- `priority: high` - Importante para siguiente release
- `priority: medium` - Mejora significativa
- `priority: low` - Nice to have

### Tipo
- `bug` - Error reportado
- `enhancement` - Mejora existente
- `feature` - Nueva funcionalidad
- `documentation` - Cambios en docs

### Estado
- `status: in progress` - Trabajándose actualmente
- `status: needs review` - Esperando revisión
- `status: ready to merge` - Listo para integrar

## 🎯 Buenas Primeras Issues

Busca issues con las etiquetas:
- `good first issue` - Ideales para nuevos contribuidores
- `help wanted` - Se necesita ayuda de la comunidad
- `documentation` - Mejoras en la documentación

## 💬 Comunicación

### En Issues y PRs
- Sé **respetuoso** y constructivo
- Proporciona **contexto** suficiente
- Agradece las contribuciones de otros

### En Discusiones
- Usa el canal adecuado para cada tema
- Sé conciso pero completo
- Ayuda a otros contribuidores

## 🚀 Lanzamientos

### Versionamiento
- Seguimos **Semantic Versioning** (semver)
- `MAJOR.MINOR.PATCH`
- Ejemplo: `v1.2.3`

### Changelog
- Mantén un registro de cambios
- Agrupa por tipo (features, fixes, breaking changes)
- Incluye créditos a contribuidores

## 🏆 Reconocimiento

### Contribuidores
- Todos los contribuidores son reconocidos en README
- Las contribuciones significativas se destacan en releases
- Los contribuidores activos pueden ser invitados como maintainers

### Estadísticas
- Seguimos contribuciones en GitHub Insights
- Celebramos milestones importantes
- Reconocemos mejoras de rendimiento y seguridad

## 📋 Checklist Antes de Contribuir

- [ ] He leído la **Code of Conduct**
- [ ] Mi código sigue los **estándares** del proyecto
- [ ] He **probado** mis cambios
- [ ] He **documentado** los cambios necesarios
- [ ] Mis **commits** siguen el formato requerido
- [ ] He buscado **issues** similares antes de crear uno nuevo

## ❓ Preguntas Frecuentes

### ¿Puedo contribuir si soy principiante?
¡Sí! Busca issues con `good first issue` o `help wanted`.

### ¿Qué tecnología necesito conocer?
- **Backend**: Python, FastAPI, MongoDB
- **Frontend**: React, JavaScript, Tailwind CSS
- **DevOps**: Docker, Git, GitHub

### ¿Cómo obtengo ayuda?
- Crea un issue con la etiqueta `question`
- Participa en las **Discussions** de GitHub
- Revisa la documentación existente

---

## 🙏 Agradecimiento

¡Gracias por dedicar tu tiempo a mejorar VinoPorMi! Cada contribución, por pequeña que sea, ayuda a hacer el proyecto mejor para toda la comunidad.

**¡Tu contribución importa! 🍷✨**