import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  History, 
  Filter, 
  Package, 
  Users, 
  TrendingDown, 
  User as UserIcon,
  Calendar,
  Search,
  Plus,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsiveTable from '@/components/ResponsiveTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Auditoria = () => {
  const { getAuthHeader } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegistro, setSelectedRegistro] = useState(null);
  const [filters, setFilters] = useState({
    entidad: 'todos', // 'todos', 'producto', 'cliente', 'egreso', 'usuario'
    accion: 'todos', // 'todos', 'creado', 'modificado', 'eliminado'
    fechaDesde: '',
    fechaHasta: '',
    search: ''
  });

  const fetchRegistros = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      
      if (filters.entidad !== 'todos') params.append('entidad', filters.entidad);
      if (filters.accion !== 'todos') params.append('accion', filters.accion);
      if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
      if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(`${API}/auditoria?${params.toString()}`, {
        headers: getAuthHeader(),
      });
      setRegistros(response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permisos para ver la auditoría');
      } else {
        toast.error('Error al cargar los registros de auditoría');
      }
    } finally {
      setLoading(false);
    }
  }, [filters, getAuthHeader]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  const getEntidadIcon = (entidad) => {
    switch (entidad) {
      case 'producto': return <Package className="w-4 h-4 text-blue-600" />;
      case 'cliente': return <Users className="w-4 h-4 text-green-600" />;
      case 'egreso': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'usuario': return <UserIcon className="w-4 h-4 text-purple-600" />;
      default: return <History className="w-4 h-4 text-gray-600" />;
    }
  };

  const getAccionIcon = (accion) => {
    switch (accion) {
      case 'creado': return <Plus className="w-4 h-4 text-green-600" />;
      case 'modificado': return <Edit className="w-4 h-4 text-yellow-600" />;
      case 'eliminado': return <Trash2 className="w-4 h-4 text-red-600" />;
      default: return <History className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEntidadBadge = (entidad) => {
    const badges = {
      'producto': { label: 'Producto', color: 'bg-blue-100 text-blue-800' },
      'cliente': { label: 'Cliente', color: 'bg-green-100 text-green-800' },
      'egreso': { label: 'Egreso', color: 'bg-red-100 text-red-800' },
      'usuario': { label: 'Usuario', color: 'bg-purple-100 text-purple-800' }
    };
    return badges[entidad] || { label: entidad, color: 'bg-gray-100 text-gray-800' };
  };

  const getAccionBadge = (accion) => {
    const badges = {
      'creado': { label: 'Creado', color: 'bg-green-100 text-green-800' },
      'modificado': { label: 'Modificado', color: 'bg-yellow-100 text-yellow-800' },
      'eliminado': { label: 'Eliminado', color: 'bg-red-100 text-red-800' }
    };
    return badges[accion] || { label: accion, color: 'bg-gray-100 text-gray-800' };
  };

  const formatValores = (valores) => {
    if (!valores) return '-';
    return JSON.stringify(valores, null, 2).substring(0, 100) + (JSON.stringify(valores).length > 100 ? '...' : '');
  };

  if (loading) {
    return <div className="text-center py-8">Cargando registros de auditoría...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Auditoría del Sistema</h1>
        <p className="text-muted-foreground">
          Registro de todas las altas, bajas y modificaciones
        </p>
      </div>

      {/* FILTROS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Entidad</Label>
              <Select
                value={filters.entidad}
                onValueChange={(value) => setFilters({ ...filters, entidad: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las entidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="producto">Productos</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                  <SelectItem value="usuario">Usuarios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Acción</Label>
              <Select
                value={filters.accion}
                onValueChange={(value) => setFilters({ ...filters, accion: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las acciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="creado">Creados</SelectItem>
                  <SelectItem value="modificado">Modificados</SelectItem>
                  <SelectItem value="eliminado">Eliminados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={filters.fechaDesde}
                onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={filters.fechaHasta}
                onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Búsqueda</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o valor..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
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
            className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => setSelectedRegistro(registro)}
          >
            <td className="p-4 text-sm">
              {format(new Date(registro.fecha), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
            </td>
            <td className="p-4">
              <div className="flex items-center gap-2">
                {getEntidadIcon(registro.entidad)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEntidadBadge(registro.entidad).color}`}>
                  {getEntidadBadge(registro.entidad).label}
                </span>
              </div>
            </td>
            <td className="p-4">
              <div className="flex items-center gap-2">
                {getAccionIcon(registro.accion)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccionBadge(registro.accion).color}`}>
                  {getAccionBadge(registro.accion).label}
                </span>
              </div>
            </td>
            <td className="p-4 text-sm">
              <div>
                <div className="font-medium">{registro.usuario_nombre}</div>
                {registro.ip_address && (
                  <div className="text-xs text-muted-foreground font-mono">
                    {registro.ip_address}
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(registro, index) => (
          <div 
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setSelectedRegistro(registro)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getEntidadIcon(registro.entidad)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEntidadBadge(registro.entidad).color}`}>
                  {getEntidadBadge(registro.entidad).label}
                </span>
                {getAccionIcon(registro.accion)}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccionBadge(registro.accion).color}`}>
                  {getAccionBadge(registro.accion).label}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {format(new Date(registro.fecha), 'PPP HH:mm:ss', { locale: es })}
              </div>
              <div className="text-sm">
                <span className="font-medium">Por: </span>
                <span>{registro.usuario_nombre}</span>
                {registro.ip_address && (
                  <span className="text-xs font-mono text-muted-foreground ml-2">
                    ({registro.ip_address})
                  </span>
                )}
              </div>
              <div className="font-semibold text-foreground">
                {registro.entidad_nombre || registro.entidad_id}
              </div>
            </div>
          </div>
        )}
      />

      {registros.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {getEntidadIcon(selectedRegistro.entidad)}
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEntidadBadge(selectedRegistro.entidad).color}`}>
                    {getEntidadBadge(selectedRegistro.entidad).label}
                  </span>
                  {getAccionIcon(selectedRegistro.accion)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccionBadge(selectedRegistro.accion).color}`}>
                    {getAccionBadge(selectedRegistro.accion).label}
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* INFORMACIÓN GENERAL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Elemento</Label>
                  <div className="font-semibold text-foreground mt-1">
                    {selectedRegistro.entidad_nombre || selectedRegistro.entidad_id}
                  </div>
                </div>
                <div>
                  <Label>Fecha y Hora</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedRegistro.fecha), 'PPP HH:mm:ss', { locale: es })}
                  </div>
                </div>
                <div>
                  <Label>Usuario</Label>
                  <div className="font-medium mt-1">
                    {selectedRegistro.usuario_nombre}
                  </div>
                  {selectedRegistro.ip_address && (
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      IP: {selectedRegistro.ip_address}
                    </div>
                  )}
                </div>
              </div>

              {/* VALORES ANTERIORES */}
              {selectedRegistro.valores_anteriores && (
                <div>
                  <Label className="text-base font-medium mb-3 block">Valores Anteriores</Label>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedRegistro.valores_anteriores, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* VALORES NUEVOS */}
              {selectedRegistro.valores_nuevos && (
                <div>
                  <Label className="text-base font-medium mb-3 block">Valores Nuevos</Label>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedRegistro.valores_nuevos, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* ID DEL REGISTRO */}
              <div>
                <Label>ID de Auditoría</Label>
                <div className="text-xs text-muted-foreground font-mono mt-1">
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
