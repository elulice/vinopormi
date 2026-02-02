import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CuentaCorriente = () => {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [cuentaInfo, setCuentaInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    concepto: '',
    monto: ''
  });

  useEffect(() => {
    fetchCuentaCorriente();
  }, [clienteId]);

  const fetchCuentaCorriente = async () => {
    try {
      const response = await axios.get(
        `${API}/clientes/${clienteId}/cuenta-corriente`,
        { headers: getAuthHeader() }
      );
      setCuentaInfo(response.data);
    } catch (error) {
      toast.error('Error al cargar cuenta corriente');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(
        `${API}/clientes/${clienteId}/movimientos?concepto=${encodeURIComponent(formData.concepto)}&monto=${parseFloat(formData.monto)}`,
        {},
        { headers: getAuthHeader() }
      );
      
      toast.success('Movimiento registrado');
      setDialogOpen(false);
      setFormData({ concepto: '', monto: '' });
      fetchCuentaCorriente();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar movimiento');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  if (!cuentaInfo) {
    return <div className="text-center py-8">Cliente no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/clientes')}
          className="mb-4"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Clientes
        </Button>
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Cuenta Corriente
        </h1>
        <p className="text-muted-foreground">{cuentaInfo.cliente.nombre}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Saldo Actual</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-movimiento-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Movimiento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Movimiento</DialogTitle>
                  <DialogDescription>
                    Registra un nuevo movimiento en la cuenta corriente del cliente
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="concepto">Concepto</Label>
                    <Input
                      id="concepto"
                      value={formData.concepto}
                      onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                      required
                      placeholder="Ej: Pago, Abono"
                      data-testid="movimiento-concepto-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monto">Monto (positivo para abono, negativo para cargo)</Label>
                    <Input
                      id="monto"
                      type="number"
                      step="0.01"
                      value={formData.monto}
                      onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                      required
                      data-testid="movimiento-monto-input"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1" data-testid="movimiento-submit-button">
                      Registrar
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
        </CardHeader>
        <CardContent>
          <div className={`text-4xl font-bold ${
            cuentaInfo.saldo < 0 ? 'text-destructive' : 'text-primary'
          }`} data-testid="saldo-actual">
            {formatCurrency(Math.abs(cuentaInfo.saldo))}
            {cuentaInfo.saldo < 0 && ' (debe)'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {cuentaInfo.movimientos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay movimientos registrados
            </p>
          ) : (
            <div className="space-y-2">
              {cuentaInfo.movimientos.map((mov) => (
                <div
                  key={mov.id}
                  className="flex justify-between items-center p-4 bg-muted rounded-md"
                  data-testid={`movimiento-${mov.id}`}
                >
                  <div className="flex items-center gap-3">
                    {mov.monto > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium">{mov.concepto}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(mov.fecha), 'PPP', { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${
                    mov.monto > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {mov.monto > 0 ? '+' : ''}
                    {formatCurrency(mov.monto)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CuentaCorriente;