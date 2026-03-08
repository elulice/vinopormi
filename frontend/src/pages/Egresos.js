import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfig } from '@/context/ConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatNumber } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  Filter,
  Calendar,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';
import SearchInput from '@/components/common/SearchInput';
import DeleteConfirmDialog from '@/components/common/DeleteConfirmDialog';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';



const Egresos = () => {
  const { showCents } = useConfig();
  const [searchParams] = useSearchParams();
  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingEgreso, setEditingEgreso] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    descripcion: '',
    monto: ''
  });

  // Estados para filtros y ordenamiento
  const [filters, setFilters] = useState({
    dateType: 'all', // 'all', 'specific', 'range'
    specificDate: '',
    startDate: '',
    endDate: ''
  });

  // Efecto para aplicar filtro automático desde URL params
  useEffect(() => {
    const autoFilter = searchParams.get('filter');
    if (autoFilter === 'today') {
      setFilters(prev => ({
        ...prev,
        dateType: 'specific',
        specificDate: format(new Date(), 'yyyy-MM-dd')
      }));
    }
  }, [searchParams]);

  const fetchEgresos = useCallback(async () => {
    try {
      const response = await apiGet(`${API}/egresos`);
      setEgresos(response.data);
    } catch {
      toast.error('Error al cargar egresos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEgresos();
  }, [fetchEgresos]);

  const resetForm = () => {
    setFormData({ descripcion: '', monto: '' });
    setEditingEgreso(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      descripcion: formData.descripcion,
      monto: parseFloat(formData.monto),
      categoria: 'Otros', // Valor por defecto para el backend
    };

    try {
      if (editingEgreso) {
        await apiPut(`${API}/egresos/${editingEgreso.id}`, data);
        toast.success('Egreso actualizado');
      } else {
        await apiPost(`${API}/egresos`, data);
        toast.success('Egreso creado');
      }

      setDialogOpen(false);
      resetForm();
      fetchEgresos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar egreso');
    }
  };

  const handleEdit = (egreso) => {
    setEditingEgreso(egreso);
    setFormData({
      descripcion: egreso.descripcion,
      monto: String(egreso.monto),
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await apiDelete(`${API}/egresos/${deletingId}`);
      toast.success('Egreso eliminado');
      fetchEgresos();
    } catch {
      toast.error('Error al eliminar egreso');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      dateType: 'all',
      specificDate: '',
      startDate: '',
      endDate: ''
    });
  };

  const filteredEgresos = egresos.filter((egreso) => {
    // Filtro por texto
    const matchesSearch = egreso.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por fecha
    let matchesDate = true;
    if (filters.dateType === 'specific' && filters.specificDate) {
      const egresoDate = parseISO(egreso.fecha);
      const filterDate = parseISO(filters.specificDate);
      matchesDate = isWithinInterval(egresoDate, {
        start: startOfDay(filterDate),
        end: endOfDay(filterDate)
      });
    } else if (filters.dateType === 'range' && filters.startDate && filters.endDate) {
      const egresoDate = parseISO(egreso.fecha);
      const start = parseISO(filters.startDate);
      const end = parseISO(filters.endDate);
      matchesDate = isWithinInterval(egresoDate, {
        start: startOfDay(start),
        end: endOfDay(end)
      });
    }
    
    return matchesSearch && matchesDate;
  });

  // Calcular total de egresos filtrados
  const totalEgresos = filteredEgresos.reduce((sum, egreso) => sum + egreso.monto, 0);

  const totalEgresosHoy = filteredEgresos
    .filter(e => {
      const ahora = new Date();
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const mañana = new Date(hoy);
      mañana.setDate(mañana.getDate() + 1);
      
      const fechaEgreso = new Date(e.fecha);
      return fechaEgreso >= hoy && fechaEgreso < mañana;
    })
    .reduce((sum, e) => sum + e.monto, 0);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-3">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Egresos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los gastos y pagos de tu vinoteca
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <Card className="py-3">
        <CardHeader className="py-2 pb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Tipo de filtro de fecha */}
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select
                value={filters.dateType}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, dateType: value }))
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="specific">Fecha específica</SelectItem>
                  <SelectItem value="range">Rango</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha específica */}
            {filters.dateType === 'specific' && (
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={filters.specificDate}
                  className="h-7 text-xs"
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, specificDate: e.target.value }))
                  }
                />
              </div>
            )}

            {/* Rango de fechas */}
            {filters.dateType === 'range' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    className="h-7 text-xs"
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    className="h-7 text-xs"
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  />
                </div>
              </>
            )}

            {/* Botón limpiar filtros */}
            {(filters.dateType !== 'all' || filters.specificDate || filters.startDate || filters.endDate) && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 text-xs w-full"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>

          {/* Estadísticas */}
          <div className="flex items-center justify-between pt-2 border-t text-xs">
            <div className="text-muted-foreground">
              {filteredEgresos.length} egresos
            </div>
            <div className="font-bold text-destructive">
              Total: {formatCurrency(totalEgresos, showCents)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BUSCADOR + BOTÓN AGREGAR */}
      <div className="flex gap-2 items-center">
        <SearchInput
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          onClear={() => setSearchTerm('')}
        />

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Nuevo
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {editingEgreso ? 'Editar Egreso' : 'Nuevo Egreso'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Descripción</Label>
                <Input
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  required
                  placeholder="Ej: Pago a proveedor de vinos"
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Monto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.monto}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monto: e.target.value,
                      })
                    }
                    required
                    placeholder="0.00"
                    className="h-8 pl-6"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1 h-8">
                  {editingEgreso ? 'Actualizar' : 'Crear Egreso'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="h-8"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABLA RESPONSIVA */}
      <ResponsiveTable
        headers={[
          { title: 'Descripción', width: '30%' },
          { title: 'Fecha', width: '15%' },
          { title: 'Usuario', width: '20%' },
          { title: 'Monto', width: '15%' },
          { title: 'Acción', width: '20%' }
        ]}
        rows={filteredEgresos}
        renderDesktopRow={(egreso, index) => (
          <tr key={egreso.id} className="border-b">
            <td className="p-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingDown className="w-3 h-3 text-destructive" />
                <span className="truncate">{egreso.descripcion}</span>
              </div>
            </td>
            <td className="p-2 text-muted-foreground text-xs">
              {format(new Date(egreso.fecha), 'dd/MM/yyyy')}
            </td>
            <td className="p-2 text-muted-foreground text-xs">
              {egreso.usuario_nombre || '-'}
            </td>
            <td className="p-2 font-semibold text-destructive text-xs">
                  {formatCurrency(egreso.monto, showCents)}
            </td>
            <td className="p-2 text-right">
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-1"
                  onClick={() => handleEdit(egreso)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-1 text-destructive"
                  onClick={() => handleDelete(egreso.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(egreso, index) => (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-destructive/10 rounded flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm truncate">{egreso.descripcion}</h3>
                <div className="font-bold text-destructive text-sm">
              {formatCurrency(egreso.monto, showCents)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{format(new Date(egreso.fecha), 'dd/MM/yyyy')}</span>
              {egreso.usuario_nombre && <span>{egreso.usuario_nombre}</span>}
            </div>
            
            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(egreso)}
                className="flex-1 h-7 text-xs"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive flex-1 h-7 text-xs"
                onClick={() => handleDelete(egreso.id)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />

      {/* ESTADO VACÍO */}
      {filteredEgresos.length === 0 && (
        <Card className="py-6">
          <CardContent className="py-6 text-center">
            <TrendingDown className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? `No se encontraron egresos con "${searchTerm}"`
                : 'No hay egresos registrados aún.'}
            </p>
          </CardContent>
        </Card>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Eliminar egreso"
        description="¿Estás seguro de eliminar este egreso? Esta acción no se puede deshacer."
      />
    </div>
  );
};

export default Egresos;
