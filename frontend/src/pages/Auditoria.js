import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import { SkeletonTable } from '@/components/Skeleton';
import { 
  History, 
  Filter, 
  Package, 
  Users, 
  TrendingDown, 
  User as UserIcon,
  Search,
  Plus,
  Edit,
  Trash2,
  StickyNote,
  Truck,
  FileText,
  Ban,
  Tags
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';
import StatusBadge from '@/components/common/StatusBadge';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';

const ENTIDAD_LABELS = {
  producto: 'producto',
  categoria: 'categoría',
  cliente: 'cuenta corriente',
  proveedor: 'proveedor',
  egreso: 'egreso',
  usuario: 'usuario',
  presupuesto: 'presupuesto',
  sticky_note: 'nota',
};

const VERBOS_ACCION = {
  creado: 'creó',
  crear: 'creó',
  modificado: 'modificó',
  actualizar: 'actualizó',
  eliminado: 'eliminó',
  eliminar: 'eliminó',
  revocado: 'revocó el enlace de',
};

const ETIQUETAS_CAMPO = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  dni: 'DNI',
  telefono: 'Teléfono',
  email: 'Email',
  username: 'Usuario',
  rol: 'Rol',
  descripcion: 'Descripción',
  monto: 'Monto',
  categoria: 'Categoría',
  categoria_id: 'Categoría',
  categoria_nombre: 'Nombre de categoría',
  productos_actualizados: 'Productos actualizados',
  precio_unitario: 'Precio unitario',
  precio_costo: 'Precio de costo',
  stock: 'Stock',
  descuento_cantidad_minima: 'Cantidad mínima para descuento',
  descuento_precio_unitario: 'Precio con descuento',
  activo: 'Enlace activo',
  vinoteca_nombre: 'Vinoteca',
  observaciones: 'Observaciones',
  descuento: 'Descuento',
  items: 'Productos',
  tipo: 'Tipo',
  is_public: 'Público',
  is_featured: 'Destacado',
  timestamp: 'Fecha',
  fecha: 'Fecha',
  fecha_creacion: 'Fecha de creación',
};

const CAMPOS_MONEDA = new Set([
  'monto', 'precio_unitario', 'precio_costo', 'descuento_monto', 'descuento_precio_unitario'
]);
const CAMPOS_TECNICOS = new Set(['id', 'token', 'password', '_id']);
const CAMPOS_FECHA = new Set(['fecha', 'fecha_creacion', 'timestamp', 'fecha_emision']);

const formatearValor = (campo, valor) => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';

  if (CAMPOS_FECHA.has(campo)) {
    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) return format(fecha, 'dd/MM/yyyy HH:mm');
  }

  if (campo === 'items' && Array.isArray(valor)) {
    return valor.map((item) => {
      const nombre = item?.nombre || item?.producto_id || 'Producto';
      const cantidad = item?.cantidad ?? 1;
      const precio = item?.precio_unitario != null
        ? ` (${formatCurrency(item.precio_unitario, false)})`
        : '';
      return `${cantidad}× ${nombre}${precio}`;
    }).join(' · ');
  }

  if (Array.isArray(valor)) return valor.map((v) => String(v)).join(', ');
  if (typeof valor === 'object') {
    return Object.entries(valor)
      .map(([clave, valorHijo]) => `${ETIQUETAS_CAMPO[clave] || clave}: ${formatearValor(clave, valorHijo)}`)
      .join(' · ');
  }

  if (CAMPOS_MONEDA.has(campo) && !Number.isNaN(Number(valor))) {
    return formatCurrency(Number(valor));
  }

  const texto = String(valor);
  return texto.length > 140 ? `${texto.slice(0, 140)}…` : texto;
};

const ResumenCambios = ({ anteriores, nuevos }) => {
  const anterior = anteriores && typeof anteriores === 'object' ? anteriores : {};
  const nuevo = nuevos && typeof nuevos === 'object' ? nuevos : {};
  const comparar = Object.keys(anterior).length > 0 && Object.keys(nuevo).length > 0;

  const campos = Array.from(new Set([...Object.keys(anterior), ...Object.keys(nuevo)]))
    .filter((campo) => !CAMPOS_TECNICOS.has(campo))
    .filter((campo) => {
      const antes = formatearValor(campo, anterior[campo]);
      const despues = formatearValor(campo, nuevo[campo]);
      if (antes === '—' && despues === '—') return false;
      if (!comparar) return true;
      if (antes === despues) return false;
      // Si el campo no estaba en el snapshot anterior, no podemos afirmar que cambió.
      if (antes === '—' && !Object.prototype.hasOwnProperty.call(anterior, campo)) return false;
      return true;
    });

  if (!campos.length) {
    return <p className="text-xs text-muted-foreground py-3">No hay valores registrados para este evento.</p>;
  }

  const columnas = comparar
    ? '110px minmax(0, 1fr) minmax(0, 1fr)'
    : '130px minmax(0, 1fr)';
  // En altas el valor está en "nuevos"; en bajas, en "anteriores".
  const fuente = comparar || Object.keys(nuevo).length === 0 ? anterior : nuevo;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div
        className="grid gap-2 bg-muted/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        style={{ gridTemplateColumns: columnas }}
      >
        <span>Campo</span>
        <span>{comparar ? 'Antes' : 'Valor'}</span>
        {comparar && <span>Ahora</span>}
      </div>
      {campos.map((campo) => (
        <div
          key={campo}
          className="grid gap-2 border-t border-border px-3 py-2 items-start"
          style={{ gridTemplateColumns: columnas }}
        >
          <span className="text-xs font-medium text-foreground break-words">
            {ETIQUETAS_CAMPO[campo] || campo}
          </span>
          <span className={`text-xs break-words ${comparar ? 'text-muted-foreground' : 'text-foreground'}`}>
            {formatearValor(campo, fuente[campo])}
          </span>
          {comparar && (
            <span className="text-xs font-medium text-foreground break-words">
              {formatearValor(campo, nuevo[campo])}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

const Auditoria = () => {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    has_next: false,
    has_prev: false
  });
  const [filters, setFilters] = useState({
    entidad: 'todos',
    accion: 'todos',
    fechaDesde: '',
    fechaHasta: '',
    search: ''
  });

  const fetchRegistrosRef = useRef(null);

  const fetchRegistros = useCallback(async (page = 1) => {
    setLoadingPage(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 50);
      
      if (filters.entidad !== 'todos') params.append('entidad', filters.entidad);
      if (filters.accion !== 'todos') params.append('accion', filters.accion);
      if (filters.fechaDesde) {
        params.append('fechaDesde', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        params.append('fechaHasta', filters.fechaHasta);
      }
      if (filters.search) params.append('search', filters.search);

      const response = await apiGet(`${API}/auditoria?${params.toString()}`);
      
      const data = response.data;
      setRegistros(data.data || data);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          pages: data.pagination.pages,
          has_next: data.pagination.page < data.pagination.pages,
          has_prev: data.pagination.page > 1
        });
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permisos para ver la auditoría');
      } else {
        toast.error('Error al cargar los registros de auditoría');
      }
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
  }, [filters]);

  fetchRegistrosRef.current = fetchRegistros;

  const handlePageChange = (newPage) => {
    fetchRegistros(newPage);
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    // El useEffect detectará el cambio en filters y ejecutará fetchRegistros
  };

  // Effect para cargar datos cuando cambian los filtros
  useEffect(() => {
    fetchRegistrosRef.current?.(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const getEntidadIcon = (entidad) => {
    switch (entidad) {
      case 'producto': return <Package className="w-3 h-3 text-blue-600" />;
      case 'categoria': return <Tags className="w-3 h-3 text-teal-600" />;
      case 'cliente': return <Users className="w-3 h-3 text-green-600" />;
      case 'proveedor': return <Truck className="w-3 h-3 text-orange-600" />;
      case 'egreso': return <TrendingDown className="w-3 h-3 text-red-600" />;
      case 'usuario': return <UserIcon className="w-3 h-3 text-purple-600" />;
      case 'presupuesto': return <FileText className="w-3 h-3 text-indigo-600" />;
      case 'sticky_note': return <StickyNote className="w-3 h-3 text-yellow-600" />;
      default: return <History className="w-3 h-3 text-gray-600" />;
    }
  };

  const getAccionIcon = (accion) => {
    switch (accion) {
      case 'creado':
      case 'crear':
        return <Plus className="w-3 h-3 text-green-600" />;
      case 'modificado':
      case 'actualizar':
        return <Edit className="w-3 h-3 text-yellow-600" />;
      case 'eliminado':
      case 'eliminar':
        return <Trash2 className="w-3 h-3 text-red-600" />;
      case 'revocado':
        return <Ban className="w-3 h-3 text-orange-600" />;
      default:
        return <History className="w-3 h-3 text-gray-600" />;
    }
  };

  const getEntidadBadge = (entidad) => {
    return <StatusBadge status={entidad} size="sm" />;
  };

  const getAccionBadge = (accion) => {
    return <StatusBadge status={accion} size="sm" />;
  };

  if (loading) {
    return <SkeletonTable rows={8} columns={4} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Registro de todas las altas, bajas y modificaciones
        </p>
      </div>

      {/* FILTROS */}
      <Card className="py-3">
        <CardHeader className="py-2 pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Entidad</Label>
              <Select
                value={filters.entidad}
                onValueChange={(value) => handleFilterChange({ ...filters, entidad: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="producto">Productos</SelectItem>
                  <SelectItem value="categoria">Categorías</SelectItem>
                  <SelectItem value="cliente">Ctas Ctes</SelectItem>
                  <SelectItem value="proveedor">Proveedores</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                  <SelectItem value="usuario">Usuarios</SelectItem>
                  <SelectItem value="presupuesto">Presupuestos</SelectItem>
                  <SelectItem value="sticky_note">Notas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Acción</Label>
              <Select
                value={filters.accion}
                onValueChange={(value) => handleFilterChange({ ...filters, accion: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="creado">Creados</SelectItem>
                  <SelectItem value="modificado">Modificados</SelectItem>
                  <SelectItem value="revocado">Revocados</SelectItem>
                  <SelectItem value="eliminado">Eliminados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={filters.fechaDesde}
                onChange={(e) => handleFilterChange({ ...filters, fechaDesde: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={filters.fechaHasta}
                onChange={(e) => handleFilterChange({ ...filters, fechaHasta: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Búsqueda</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      fetchRegistros(1);
                    }
                  }}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABLA DE REGISTROS */}
      <ResponsiveTable
        headers={[
          { title: 'Fecha', width: '25%' },
          { title: 'Entidad', width: '25%' },
          { title: 'Acción', width: '25%' },
          { title: 'Usuario', width: '25%' }
        ]}
        rows={registros}
        renderDesktopRow={(registro, index) => (
          <tr 
            key={registro.id} 
            className="border-b cursor-pointer"
            onClick={() => setSelectedRegistro(registro)}
          >
            <td className="p-2 text-xs text-muted-foreground">
              {format(new Date(registro.fecha), 'dd/MM/yyyy HH:mm')}
            </td>
            <td className="p-2">
              <div className="flex items-center gap-1">
                {getEntidadIcon(registro.entidad)}
                {getEntidadBadge(registro.entidad)}
              </div>
            </td>
            <td className="p-2">
              <div className="flex items-center gap-1">
                {getAccionIcon(registro.accion)}
                {getAccionBadge(registro.accion)}
              </div>
            </td>
            <td className="p-2 text-xs font-medium">
              {registro.usuario_nombre}
            </td>
          </tr>
        )}
        renderMobileCard={(registro, index) => (
          <div 
            className="p-3 cursor-pointer"
            onClick={() => setSelectedRegistro(registro)}
          >
            <div className="flex items-center gap-1 mb-2">
              {getEntidadIcon(registro.entidad)}
              {getEntidadBadge(registro.entidad)}
              {getAccionIcon(registro.accion)}
              {getAccionBadge(registro.accion)}
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{format(new Date(registro.fecha), 'dd/MM/yyyy HH:mm')}</span>
              <span>{registro.usuario_nombre}</span>
            </div>
            <div className="text-xs truncate">
              {registro.entidad_nombre || registro.entidad_id}
            </div>
          </div>
        )}
      />

      {/* PAGINACIÓN */}
      {!loading && pagination.pages > 1 && (
        <Card className="py-2">
          <CardContent className="p-0">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
              hasNext={pagination.has_next}
              hasPrev={pagination.has_prev}
              loading={loadingPage}
            />
          </CardContent>
        </Card>
      )}

      {registros.length === 0 && !loading && (
        <Card className="py-6">
          <CardContent className="py-6 text-center">
            <History className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {filters.search || filters.entidad !== 'todos' || filters.accion !== 'todos'
                ? 'No se encontraron registros con los filtros aplicados'
                : 'No hay registros de auditoría disponibles'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* MODAL DE DETALLES */}
      {selectedRegistro && (
        <Dialog open={!!selectedRegistro} onOpenChange={() => setSelectedRegistro(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle>Detalle de la auditoría</DialogTitle>
              <div className="flex flex-wrap items-center gap-1 pt-1">
                {getEntidadIcon(selectedRegistro.entidad)}
                {getEntidadBadge(selectedRegistro.entidad)}
                {getAccionIcon(selectedRegistro.accion)}
                {getAccionBadge(selectedRegistro.accion)}
              </div>
            </DialogHeader>

            <div className="px-1 pb-2 space-y-4">
              {/* RESUMEN EN LENGUAJE NATURAL */}
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                  <span className="font-semibold text-foreground">
                    {selectedRegistro.usuario_nombre || 'El sistema'}
                  </span>
                  <span className="text-muted-foreground">
                    {VERBOS_ACCION[selectedRegistro.accion] || 'registró'}
                  </span>
                  <span>{ENTIDAD_LABELS[selectedRegistro.entidad] || selectedRegistro.entidad}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold text-foreground">
                    {selectedRegistro.entidad_nombre || selectedRegistro.entidad_id}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(selectedRegistro.fecha), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                </p>
              </div>

              {/* CAMBIOS EN TABLA, EN LUGAR DE JSON */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {selectedRegistro.accion === 'creado' || selectedRegistro.accion === 'crear'
                    ? 'Datos registrados'
                    : selectedRegistro.accion === 'eliminado' || selectedRegistro.accion === 'eliminar'
                      ? 'Datos al eliminar'
                      : 'Cambios registrados'}
                </h3>
                <ResumenCambios
                  anteriores={selectedRegistro.valores_anteriores}
                  nuevos={selectedRegistro.valores_nuevos}
                />
              </div>

              {/* TRAZABILIDAD TÉCNICA, PLEGADA */}
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                  Ver datos técnicos (JSON)
                </summary>
                <div className="space-y-2 border-t border-border p-3">
                  {selectedRegistro.valores_anteriores && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">Valores anteriores</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/50 rounded p-2">
                        {JSON.stringify(selectedRegistro.valores_anteriores, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedRegistro.valores_nuevos && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">Valores nuevos</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/50 rounded p-2">
                        {JSON.stringify(selectedRegistro.valores_nuevos, null, 2)}
                      </pre>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground break-words">
                    ID del registro: <span className="font-mono">{selectedRegistro.id}</span>
                    {selectedRegistro.ip_address && (
                      <> · IP: <span className="font-mono">{selectedRegistro.ip_address}</span></>
                    )}
                  </p>
                </div>
              </details>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Auditoria;
