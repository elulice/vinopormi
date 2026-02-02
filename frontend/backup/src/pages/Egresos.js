import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;



const Egresos = () => {
  const { getAuthHeader } = useAuth();
  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEgreso, setEditingEgreso] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    descripcion: '',
    monto: ''
  });

  const fetchEgresos = async () => {
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
  };

  useEffect(() => {
    fetchEgresos();
  }, []);

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

  const filteredEgresos = egresos.filter((e) =>
    e.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEgresosHoy = filteredEgresos
    .filter(e => {
      const hoy = new Date();
      const fechaEgreso = new Date(e.fecha);
      return fechaEgreso.toDateString() === hoy.toDateString();
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
        <div className="text-right">
          <div className="text-2xl font-bold text-destructive">
            ${totalEgresosHoy.toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground">Egresos de hoy</p>
        </div>
      </div>

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

      {/* TABLA */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4">Descripción</th>
                <th className="text-left p-4">Fecha</th>
                <th className="text-left p-4">Monto</th>
                <th className="text-right p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEgresos.map((egreso) => (
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
                  <td className="p-4 font-semibold text-destructive text-left">
                    ${egreso.monto.toFixed(2)}
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
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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