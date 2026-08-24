import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
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
  Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';
import StatusBadge from '@/components/common/StatusBadge';
import { apiGet } from '@/lib/api';

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
      case 'cliente': return <Users className="w-3 h-3 text-green-600" />;
      case 'proveedor': return <Truck className="w-3 h-3 text-orange-600" />;
      case 'egreso': return <TrendingDown className="w-3 h-3 text-red-600" />;
      case 'usuario': return <UserIcon className="w-3 h-3 text-purple-600" />;
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

  const formatValores = (valores) => {
    if (!valores) return '-';
    return JSON.stringify(valores, null, 2).substring(0, 100) + (JSON.stringify(valores).length > 100 ? '...' : '');
  };
 
  if (loading) {
    return <div className="text-center py-8">Cargando registros de auditoría...</div>;
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
                  <SelectItem value="cliente">Ctas Ctes</SelectItem>
                  <SelectItem value="proveedor">Proveedores</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                  <SelectItem value="usuario">Usuarios</SelectItem>
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
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader className="py-3 px-4">
              <DialogTitle className="flex items-center gap-2 text-base">
                {getEntidadIcon(selectedRegistro.entidad)}
                {getEntidadBadge(selectedRegistro.entidad)}
                {getAccionIcon(selectedRegistro.accion)}
                {getAccionBadge(selectedRegistro.accion)}
              </DialogTitle>
            </DialogHeader>

            <div className="px-4 pb-4 space-y-3">
              {/* INFORMACIÓN GENERAL */}
              <div className="grid grid-cols-2 gap-2 p-2 bg-muted rounded-md text-xs">
                <div>
                  <Label className="text-muted-foreground">Elemento</Label>
                  <div className="font-medium">
                    {selectedRegistro.entidad_nombre || selectedRegistro.entidad_id}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha</Label>
                  <div className="text-muted-foreground">
                    {format(new Date(selectedRegistro.fecha), 'dd/MM/yyyy HH:mm')}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Usuario</Label>
                  <div className="font-medium">
                    {selectedRegistro.usuario_nombre}
                  </div>
                  {selectedRegistro.ip_address && (
                    <div className="text-xs text-muted-foreground font-mono">
                      IP: {selectedRegistro.ip_address}
                    </div>
                  )}
                </div>
              </div>

              {/* VALORES ANTERIORES */}
              {selectedRegistro.valores_anteriores && (
                <div>
                  <Label className="text-xs font-medium mb-2 block">Valores Anteriores</Label>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 dark:bg-yellow-500/10 dark:border-yellow-500/30">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedRegistro.valores_anteriores, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* VALORES NUEVOS */}
              {selectedRegistro.valores_nuevos && (
                <div>
                  <Label className="text-xs font-medium mb-2 block">Valores Nuevos</Label>
                  <div className="bg-green-50 border border-green-200 rounded-md p-2 dark:bg-green-500/10 dark:border-green-500/30">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedRegistro.valores_nuevos, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* ID DEL REGISTRO */}
              <div>
                <Label className="text-xs">ID de Auditoría</Label>
                <div className="text-xs text-muted-foreground font-mono">
                  {selectedRegistro.id}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Auditoria;
