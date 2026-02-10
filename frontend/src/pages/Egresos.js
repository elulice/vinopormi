import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
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
  Search,
  Filter,
  X,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsiveTable from '@/components/ResponsiveTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;



const Egresos = () => {
  const { getAuthHeader } = useAuth();
  const { showCents } = useConfig();
  const [searchParams] = useSearchParams();
  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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
      const response = await axios.get(`${API}/egresos`, {
        headers: getAuthHeader(),
      });
      setEgresos(response.data);
    } catch {
      toast.error('Error al cargar egresos');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

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
        await axios.put(`${API}/egresos/${editingEgreso.id}`, data, {
          headers: getAuthHeader(),
        });
        toast.success('Egreso actualizado');
      } else {
        await axios.post(`${API}/egresos`, data, {
          headers: getAuthHeader(),
        });
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

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este egreso?')) return;

    try {
      await axios.delete(`${API}/egresos/${id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Egreso eliminado');
      fetchEgresos();
    } catch {
      toast.error('Error al eliminar egreso');
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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Egresos</h1>
          <p className="text-muted-foreground">
            Gestiona los gastos y pagos de tu vinoteca
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tipo de filtro de fecha */}
            <div className="space-y-2">
              <Label>Período</Label>
              <Select
                value={filters.dateType}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, dateType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="specific">Fecha específica</SelectItem>
                  <SelectItem value="range">Rango de fechas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha específica */}
            {filters.dateType === 'specific' && (
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={filters.specificDate}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, specificDate: e.target.value }))
                  }
                />
              </div>
            )}

            {/* Rango de fechas */}
            {filters.dateType === 'range' && (
              <>
                <div className="space-y-2">
                  <Label>Fecha desde</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha hasta</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  />
                </div>
              </>
            )}

            {/* Botón limpiar filtros */}
            {(filters.dateType !== 'all' || filters.specificDate || filters.startDate || filters.endDate) && (
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>

          {/* Estadísticas */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {filteredEgresos.length} egresos encontrados
            </div>
            <div className="text-lg font-bold text-destructive">
              Total: {formatCurrency(totalEgresos, showCents)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BUSCADOR + BOTÓN AGREGAR */}
      <div className="flex gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar egresos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Egreso
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEgreso ? 'Editar Egreso' : 'Nuevo Egreso'}
              </DialogTitle>
              <DialogDescription>
                {editingEgreso
                  ? 'Modifica los datos del egreso seleccionado'
                  : 'Registra un nuevo egreso o gasto'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Descripción</Label>
                <Input
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  required
                  placeholder="Ej: Pago a proveedor de vinos"
                />
              </div>

              <div>
                <Label>Monto</Label>
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
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingEgreso ? 'Actualizar' : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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
          { title: 'Descripción', width: '40%' },
          { title: 'Fecha', width: '20%' },
          { title: 'Monto', width: '20%' },
          { title: 'Acciones', width: '20%' }
        ]}
        rows={filteredEgresos}
        renderDesktopRow={(egreso, index) => (
          <tr key={egreso.id} className="border-b">
            <td className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-4 h-4 text-destructive" />
                {egreso.descripcion}
              </div>
            </td>
            <td className="p-4 text-muted-foreground">
              {format(new Date(egreso.fecha), 'dd/MM/yyyy', { locale: es })}
            </td>
            <td className="p-4 font-semibold text-destructive">
                  {formatCurrency(egreso.monto, showCents)}
            </td>
            <td className="p-4 text-right">
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(egreso)}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => handleDelete(egreso.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(egreso, index) => (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{egreso.descripcion}</h3>
                <div className="text-lg font-bold text-destructive">
              {formatCurrency(egreso.monto, showCents)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <span>{format(new Date(egreso.fecha), 'dd/MM/yyyy', { locale: es })}</span>
              <span>•</span>
              <span>Egreso registrado</span>
            </div>
            
            <div className="flex gap-2 pt-3 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(egreso)}
                className="flex-1"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive flex-1"
                onClick={() => handleDelete(egreso.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />

      {/* ESTADO VACÍO */}
      {filteredEgresos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingDown className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm
                ? `No se encontraron egresos con "${searchTerm}"`
                : 'No hay egresos registrados aún. Registra uno para empezar.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Egresos;
