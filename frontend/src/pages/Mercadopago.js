import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw,
} from 'lucide-react';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import { toast } from 'sonner';
import { format } from 'date-fns';
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
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
          <h1 className="text-2xl font-bold">Mercadopago</h1>
          <p className="text-sm text-muted-foreground">
          Historial de transferencias recibidas
          </p>
        </div>
        <div className="flex gap-1">
          <Select 
            value={minutosBusqueda.toString()} 
            onValueChange={(val) => {
              const nuevosMinutos = parseInt(val);
              setMinutosBusqueda(nuevosMinutos);
              fetchTransferencias(nuevosMinutos);
            }}
            disabled={loadingTransferencias}
          >
            <SelectTrigger className="w-32 h-7 text-xs">
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
            className="h-7 px-2"
            onClick={() => fetchTransferencias(minutosBusqueda)}
            disabled={loadingTransferencias}
          >
            <RefreshCw className={`w-3 h-3 ${loadingTransferencias ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          {loadingTransferencias ? (
            <div className="animate-pulse space-y-1">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 bg-muted rounded"></div>
              ))}
            </div>
          ) : transferencias.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">
              Sin transferencias en el período
            </p>
          ) : (
            <div className="space-y-1">
              {transferencias.map((t) => (
                <div key={t.id} className="p-2 bg-muted rounded flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{formatCurrency(t.monto, t.currency)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.fecha_aprobacion ? format(new Date(t.fecha_aprobacion), 'dd/MM • HH:mm') : '-'} • {t.descripcion || t.tipo_pago}
                    </p>
                  </div>
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-xs whitespace-nowrap">
                    {t.estado}
                  </span>
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
