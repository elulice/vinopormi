import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { API } from '@/lib/config';

const Mercadopago = () => {
  const { getAuthHeader } = useAuth();
  const [transferencias, setTransferencias] = useState([]);
  const [loadingTransferencias, setLoadingTransferencias] = useState(false);
  const [minutosBusqueda, setMinutosBusqueda] = useState(60);

  const fetchTransferencias = useCallback(async (minutos = 60) => {
    setLoadingTransferencias(true);
    try {
      const response = await axios.get(`${API}/mercadopago/buscar-transferencias?minutos=${minutos}`, {
        headers: getAuthHeader(),
      });
      setTransferencias(response.data.transferencias || []);
    } catch (error) {
      console.error('Error fetching transferencias:', error);
      toast.error('Error al buscar transferencias');
    } finally {
      setLoadingTransferencias(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchTransferencias(60);
  }, [fetchTransferencias]);

  const formatCurrency = (amount, currency = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MercadopagoIcon className="w-5 h-5" />
          <h1 className="text-xl font-bold">Mercadopago</h1>
        </div>
        <div className="flex gap-2">
          <Select 
            value={minutosBusqueda.toString()} 
            onValueChange={(val) => {
              const nuevosMinutos = parseInt(val);
              setMinutosBusqueda(nuevosMinutos);
              fetchTransferencias(nuevosMinutos);
            }}
            disabled={loadingTransferencias}
          >
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Últimos..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 min</SelectItem>
              <SelectItem value="60">Última hora</SelectItem>
              <SelectItem value="120">Últimas 2 horas</SelectItem>
              <SelectItem value="360">Últimas 6 horas</SelectItem>
              <SelectItem value="1440">Últimas 24 horas</SelectItem>
              <SelectItem value="10080">Últimos 7 días</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchTransferencias(minutosBusqueda)}
            disabled={loadingTransferencias}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingTransferencias ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Transferencias Recibidas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          {loadingTransferencias ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          ) : transferencias.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No se encontraron transferencias en el período seleccionado
            </p>
          ) : (
            <div className="space-y-2">
              {transferencias.map((t) => (
                <div key={t.id} className="p-3 bg-muted rounded flex items-center justify-between">
                  <div>
                    <p className="font-medium text-lg">{formatCurrency(t.monto, t.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.fecha_aprobacion ? format(new Date(t.fecha_aprobacion), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.descripcion || t.tipo_pago}
                    </p>
                    {t.payer_email && (
                      <p className="text-xs text-muted-foreground">
                        De: {t.payer_email}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                      {t.estado}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.tipo_pago}
                    </p>
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

export default Mercadopago;
