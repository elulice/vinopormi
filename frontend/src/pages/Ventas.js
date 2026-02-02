import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Calendar, CreditCard, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, formatNumber } from '@/lib/currency';
import ResponsiveTable from '@/components/ResponsiveTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Ventas = () => {
  const { getAuthHeader } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchVentas();
  }, []);

  const fetchVentas = async () => {
    try {
      const response = await axios.get(`${API}/ventas`, {
        headers: getAuthHeader()
      });
      setVentas(response.data);
    } catch (error) {
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (venta) => {
    setSelectedVenta(venta);
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Ventas</h1>
        <p className="text-muted-foreground">Historial de ventas realizadas</p>
      </div>

      <ResponsiveTable
        headers={[
          { title: 'Venta', width: '20%' },
          { title: 'Fecha', width: '25%' },
          { title: 'Usuario', width: '15%' },
          { title: 'Medio Pago', width: '15%' },
          { title: 'Total', width: '15%' },
          { title: 'Acciones', width: '10%' }
        ]}
        rows={ventas}
        renderDesktopRow={(venta, index) => (
          <tr
            key={venta.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleViewDetails(venta)}
            data-testid={`venta-row-${venta.id}`}
          >
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">#{venta.id.slice(0, 8)}</div>
                  {venta.cliente_nombre && (
                    <div className="text-xs text-muted-foreground">{venta.cliente_nombre}</div>
                  )}
                </div>
              </div>
            </td>
            <td className="p-4 text-sm text-muted-foreground">
              {format(new Date(venta.fecha), 'PPP HH:mm:ss', { locale: es })}
            </td>
            <td className="p-4 text-sm text-muted-foreground">
              {venta.usuario_nombre || 'Usuario desconocido'}
            </td>
            <td className="p-4">
              <span className="text-sm capitalize">{venta.medio_pago.replace('_', ' ')}</span>
            </td>
            <td className="p-4 font-semibold text-primary">
                  {formatCurrency(venta.total)}
            </td>
            <td className="p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(venta);
                }}
                data-testid={`view-details-${venta.id}`}
              >
                Ver
              </Button>
            </td>
          </tr>
        )}
        renderMobileCard={(venta, index) => (
          <div
            className="cursor-pointer hover:bg-muted/50 transition-colors rounded-lg p-4"
            onClick={() => handleViewDetails(venta)}
            data-testid={`venta-card-${venta.id}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">#{venta.id.slice(0, 8)}</div>
                  {venta.cliente_nombre && (
                    <div className="text-xs text-muted-foreground">{venta.cliente_nombre}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-primary">
              {formatCurrency(venta.total)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {venta.detalles.length} producto{venta.detalles.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {format(new Date(venta.fecha), 'PPP HH:mm:ss', { locale: es })}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4" />
                {venta.usuario_nombre || 'Usuario desconocido'}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span className="capitalize">{venta.medio_pago.replace('_', ' ')}</span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(venta);
                }}
                data-testid={`view-details-mobile-${venta.id}`}
              >
                Ver Detalles
              </Button>
            </div>
          </div>
        )}
      />

      {ventas.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay ventas aún.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Venta</DialogTitle>
            <DialogDescription>
              Información completa de la venta seleccionada
            </DialogDescription>
          </DialogHeader>
          {selectedVenta && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha y Hora</p>
                  <p className="font-medium">
                    {format(new Date(selectedVenta.fecha), 'PPP HH:mm:ss', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuario</p>
                  <p className="font-medium">
                    {selectedVenta.usuario_nombre || 'Usuario desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Medio de Pago</p>
                  <p className="font-medium capitalize">
                    {selectedVenta.medio_pago.replace('_', ' ')}
                  </p>
                </div>
                {selectedVenta.cliente_nombre && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedVenta.cliente_nombre}</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">Productos</h3>
                <div className="space-y-2">
                  {selectedVenta.detalles.map((detalle, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-muted rounded-md"
                    >
                      <div>
                        <p className="font-medium">{detalle.producto_nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {detalle.cantidad} x {formatCurrency(detalle.precio_unitario)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(detalle.subtotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                <span className="text-xl font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(selectedVenta.total)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ventas;