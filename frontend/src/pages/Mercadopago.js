import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  RefreshCw,
  Link,
  CheckCircle,
} from 'lucide-react';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { API } from '@/lib/config';
import StatusBadge from '@/components/common/StatusBadge';
import { apiGet, apiPost } from '@/lib/api';
import { useConfig } from '@/context/ConfigContext';
import { capitalizeWords } from '@/lib/utils';

const Mercadopago = () => {
  const { showCents } = useConfig();
  const [transferencias, setTransferencias] = useState([]);
  const [loadingTransferencias, setLoadingTransferencias] = useState(false);
  const [minutosBusqueda, setMinutosBusqueda] = useState(60);
  
  const [selectedTransferencia, setSelectedTransferencia] = useState(null);
  const [ventasCoincidentes, setVentasCoincidentes] = useState([]);
  const [loadingCoincidencias, setLoadingCoincidencias] = useState(false);
  const [asociaciones, setAsociaciones] = useState({});
  const [selectedVenta, setSelectedVenta] = useState(null);

  const fetchTransferencias = useCallback(async (minutos = 60) => {
    setLoadingTransferencias(true);
    try {
      const response = await apiGet(`${API}/mercadopago/buscar-transferencias?minutos=${minutos}`);
      setTransferencias(response.data.transferencias || []);
    } catch (error) {
      console.error('Error fetching transferencias:', error);
      toast.error('Error al buscar transferencias');
    } finally {
      setLoadingTransferencias(false);
    }
  }, []);

  const fetchAsociaciones = useCallback(async () => {
    try {
      const response = await apiGet(`${API}/mercadopago/obtener-asociaciones`);
      setAsociaciones(response.data.asociaciones || {});
    } catch (error) {
      console.error('Error fetching asociaciones:', error);
    }
  }, []);

  useEffect(() => {
    fetchTransferencias(60);
    fetchAsociaciones();
  }, [fetchTransferencias, fetchAsociaciones]);

  const [debugInfo, setDebugInfo] = useState(null);

  const buscarCoincidencias = async (transferencia) => {
    setLoadingCoincidencias(true);
    setDebugInfo(null);
    try {
      const fechaAprobacion = new Date(transferencia.fecha_aprobacion || transferencia.fecha_creacion);
      const fechaInicio = new Date(fechaAprobacion.getTime() - 30 * 60 * 1000);
      const fechaFin = new Date(fechaAprobacion.getTime() + 30 * 60 * 1000);
      
      const response = await apiGet(
        `${API}/mercadopago/buscar-ventas-coincidentes?` +
        `monto=${transferencia.monto}&` +
        `fecha_inicio=${encodeURIComponent(fechaInicio.toISOString())}&` +
        `fecha_fin=${encodeURIComponent(fechaFin.toISOString())}&` +
        `transferencia_id=${transferencia.id}`
      );
      const ventasEnFecha = response.data.ventas_coincidentes || [];
      
      setDebugInfo(response.data.debug);
      console.log('Ventas coincidencias (fecha + monto):', ventasEnFecha);
      setVentasCoincidentes(ventasEnFecha);
    } catch (error) {
      console.error('Error fetching ventas coincidentes:', error);
      setVentasCoincidentes([]);
    } finally {
      setLoadingCoincidencias(false);
    }
  };

  const handleTransferenciaClick = async (transferencia) => {
    setSelectedTransferencia(transferencia);
    await buscarCoincidencias(transferencia);
  };

  const asociarVenta = async (ventaId) => {
    if (!selectedTransferencia) return;
    try {
      await apiPost(`${API}/mercadopago/asociar-transferencia`, {
        transferencia_id: selectedTransferencia.id,
        venta_id: ventaId
      });
      toast.success('Transferencia asociada correctamente');
      await fetchAsociaciones();
      await buscarCoincidencias(selectedTransferencia);
    } catch (error) {
      console.error('Error asociando transferencia:', error);
      toast.error('Error al asociar transferencia');
    }
  };

  const formatCurrency = (amount, currency = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatCurrencyConfig = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(amount);
  };

  const safeParseDate = (dateStr) => {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
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
              <SelectItem value="43200">Últimos 30 días</SelectItem>
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
                <div 
                  key={t.id} 
                  className="p-2 bg-muted rounded flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleTransferenciaClick(t)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{formatCurrency(t.monto, t.currency)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.fecha_aprobacion ? format(new Date(t.fecha_aprobacion), 'dd/MM • HH:mm') : '-'} • {t.descripcion || t.tipo_pago}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {asociaciones[t.id] && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    <StatusBadge status="approved" size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTransferencia} onOpenChange={() => setSelectedTransferencia(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Detalle de Transferencia</DialogTitle>
          </DialogHeader>
          {selectedTransferencia && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-md text-xs">
                <div>
                  <p className="text-muted-foreground">Monto</p>
                  <p className="font-semibold text-lg">
                    {formatCurrency(selectedTransferencia.monto, selectedTransferencia.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <StatusBadge status={selectedTransferencia.estado} />
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha de aprobación</p>
                  <p className="font-medium">
                    {selectedTransferencia.fecha_aprobacion 
                      ? format(new Date(selectedTransferencia.fecha_aprobacion), 'dd/MM/yyyy HH:mm', { locale: es })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium capitalize">{selectedTransferencia.tipo_pago}</p>
                </div>
                {selectedTransferencia.descripcion && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Descripción</p>
                    <p className="font-medium">{selectedTransferencia.descripcion}</p>
                  </div>
                )}
                {selectedTransferencia.payer_email && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Email del pagador</p>
                    <p className="font-medium">{selectedTransferencia.payer_email}</p>
                  </div>
                )}
                {selectedTransferencia.payer_identificacion && Object.keys(selectedTransferencia.payer_identificacion).length > 0 && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Identificación</p>
                    <p className="font-medium">
                      {selectedTransferencia.payer_identificacion.type}: {selectedTransferencia.payer_identificacion.number}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-muted-foreground">ID de MercadoPago</p>
                  <p className="font-mono text-xs">{selectedTransferencia.id}</p>
                </div>
              </div>

              <div className="border-t pt-3">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <Link className="w-4 h-4" />
                  Ventas coincidentes
                </h3>
                {loadingCoincidencias ? (
                  <div className="animate-pulse space-y-2">
                    {[1,2].map(i => (
                      <div key={i} className="h-16 bg-muted rounded"></div>
                    ))}
                  </div>
                ) : ventasCoincidentes.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No se encontraron ventas coincidentes
                    </p>
                    {debugInfo && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <p className="font-medium text-yellow-800">Debug:</p>
                        <p className="text-yellow-700">Monto buscado: {formatCurrencyConfig(debugInfo.monto_buscado)}</p>
                        <p className="text-yellow-700">Ventas en rango de fecha: {debugInfo.ventas_en_fecha}</p>
                        <p className="text-yellow-700">Ventas con medio transferencia: {debugInfo.ventas_transferencia}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {ventasCoincidentes.map((venta) => (
                      <div 
                        key={venta.id}
                        className={`p-2 rounded-md text-xs cursor-pointer hover:opacity-80 ${
                          asociaciones[selectedTransferencia.id]?.venta_id === venta.id 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-muted'
                        }`}
                        onClick={() => setSelectedVenta(venta)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">
                              {venta.fecha ? format(safeParseDate(venta.fecha), 'dd/MM/yyyy HH:mm', { locale: es }) : 'Sin fecha'}
                            </p>
                            <p className="text-muted-foreground">
                              Usuario: {venta.usuario_nombre || 'Desconocido'}
                            </p>
                            <p className="font-semibold">
                              {formatCurrencyConfig(venta.total)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Medio: {venta.medio_pago || 'No especificado'}
                              {venta.pagos && venta.pagos.length > 0 && 
                                ` (${venta.pagos.map(p => p.medio_pago).join(', ')})`}
                            </p>
                          </div>
                          {asociaciones[selectedTransferencia.id]?.venta_id === venta.id ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">Asociada</span>
                            </div>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                asociarVenta(venta.id);
                              }}
                            >
                              Asociar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedVenta} onOpenChange={() => setSelectedVenta(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base">Detalle de Venta</DialogTitle>
          </DialogHeader>
          {selectedVenta && (
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
              <div className="grid grid-cols-2 gap-2 p-2 bg-muted rounded-md flex-shrink-0 text-xs">
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium text-xs">
                    {format(safeParseDate(selectedVenta.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium text-xs">
                    {selectedVenta.usuario_nombre || 'Usuario desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Medio de Pago</p>
                  {selectedVenta.pagos && selectedVenta.pagos.length > 0 ? (
                    <div className="font-medium text-xs">
                      {selectedVenta.pagos.map((pago, idx) => (
                        <div key={idx} className="capitalize">
                          {pago.medio_pago?.replace('_', ' ')}: {formatCurrencyConfig(pago.monto)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-medium capitalize text-xs">
                      {selectedVenta.medio_pago?.replace('_', ' ') ?? '—'}
                    </p>
                  )}
                </div>
                {selectedVenta.cliente_nombre && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-medium text-xs">{selectedVenta.cliente_nombre}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <h3 className="font-semibold text-sm py-1 flex-shrink-0">Productos</h3>
                <div className="flex-1 overflow-y-auto space-y-1 max-h-[40vh]">
                  {selectedVenta.detalles && selectedVenta.detalles.map((detalle, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-muted rounded-md text-xs"
                    >
                      <div>
                        <p className="font-medium text-xs">{capitalizeWords(detalle.producto_nombre)}</p>
                        <p className="text-muted-foreground text-xs">
                          {detalle.cantidad} x {formatCurrencyConfig(detalle.precio_unitario)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-xs">
                          {formatCurrencyConfig(detalle.subtotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedVenta.ajuste_monto !== 0 && (
                <div className={`flex justify-between items-center p-2 rounded-md flex-shrink-0 ${selectedVenta.ajuste_monto < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    <p className={`font-medium text-xs ${selectedVenta.ajuste_monto < 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {selectedVenta.ajuste_monto < 0 ? 'Descuento' : 'Recargo'}
                    </p>
                    {selectedVenta.ajuste_detalle && (
                      <p className="text-xs text-muted-foreground ml-1">
                        ({selectedVenta.ajuste_detalle})
                      </p>
                    )}
                  </div>
                  <p className={`font-semibold text-xs ${selectedVenta.ajuste_monto < 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {selectedVenta.ajuste_monto < 0 ? '-' : '+'}{formatCurrencyConfig(Math.abs(selectedVenta.ajuste_monto))}
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center p-2 bg-primary/10 rounded-md flex-shrink-0">
                <span className="font-bold text-sm">Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrencyConfig(selectedVenta.total)}
                </span>
              </div>

              {!asociaciones[selectedTransferencia?.id] && (
                <Button 
                  className="w-full mt-2"
                  onClick={() => {
                    asociarVenta(selectedVenta.id);
                    setSelectedVenta(null);
                  }}
                >
                  Asociar a transferencia
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mercadopago;
