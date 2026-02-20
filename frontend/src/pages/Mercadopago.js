import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertCircle,
  TrendingUp,
  Eye,
  Terminal
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { API } from '@/lib/config';

const Mercadopago = () => {
  const { getAuthHeader } = useAuth();
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    has_next: false,
    has_prev: false
  });
  const [statusFilter, setStatusFilter] = useState('todos');
  const [estadisticas, setEstadisticas] = useState(null);
  const [loadingEstadisticas, setLoadingEstadisticas] = useState(false);
  const [selectedPago, setSelectedPago] = useState(null);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState('pagos');

  const fetchPagos = useCallback(async (page = 1) => {
    setLoadingPage(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 30);
      if (statusFilter !== 'todos') {
        params.append('status', statusFilter);
      }

      const response = await axios.get(`${API}/mercadopago/pagos?${params.toString()}`, {
        headers: getAuthHeader(),
      });
      
      const data = response.data;
      setPagos(data.pagos || []);
      if (data.total !== undefined) {
        const totalPages = Math.ceil(data.total / data.limit);
        setPagination({
          page: data.skip / data.limit + 1,
          pages: totalPages,
          has_next: data.skip + data.limit < data.total,
          has_prev: data.skip > 0
        });
      }
    } catch (error) {
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
  }, [statusFilter, getAuthHeader]);

  const fetchEstadisticas = useCallback(async () => {
    setLoadingEstadisticas(true);
    try {
      const response = await axios.get(`${API}/mercadopago/estadisticas?dias=30`, {
        headers: getAuthHeader(),
      });
      setEstadisticas(response.data);
    } catch (error) {
      console.error('Error fetching estadisticas:', error);
    } finally {
      setLoadingEstadisticas(false);
    }
  }, [getAuthHeader]);

  const fetchWebhookLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await axios.get(`${API}/mercadopago/webhook-logs?limit=20`, {
        headers: getAuthHeader(),
      });
      setWebhookLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchPagos(1);
    fetchEstadisticas();
    fetchWebhookLogs();
  }, [fetchPagos, fetchEstadisticas, fetchWebhookLogs]);

  const handlePageChange = (newPage) => {
    fetchPagos(newPage);
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    fetchPagos(1);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      approved: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Aprobado' },
      pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Pendiente' },
      rejected: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Rechazado' },
      refunded: { icon: RefreshCw, color: 'text-gray-600 bg-gray-50', label: 'Reintegrado' },
      cancelled: { icon: XCircle, color: 'text-gray-600 bg-gray-50', label: 'Cancelado' },
    };
    
    const config = statusConfig[status] || { icon: AlertCircle, color: 'text-gray-600 bg-gray-50', label: status };
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount, currency = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          <h1 className="text-xl font-bold">Mercadopago</h1>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { fetchPagos(1); fetchEstadisticas(); fetchWebhookLogs(); }}
            disabled={loadingPage}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingPage ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Total Aprobado (30d)</span>
              </div>
              {loadingEstadisticas ? (
                <div className="h-7 bg-muted animate-pulse rounded"></div>
              ) : (
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(estadisticas.total_aprobado)}
                </p>
              )}
            </CardContent>
          </Card>
          {estadisticas.por_estado.map((item) => (
            <Card key={item.estado}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  {item.estado === 'approved' && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {item.estado === 'pending' && <Clock className="w-4 h-4 text-yellow-600" />}
                  {item.estado === 'rejected' && <XCircle className="w-4 h-4 text-red-600" />}
                  {item.estado === 'refunded' && <RefreshCw className="w-4 h-4 text-gray-600" />}
                  <span className="text-xs text-muted-foreground capitalize">{item.estado}</span>
                </div>
                {loadingEstadisticas ? (
                  <div className="h-7 bg-muted animate-pulse rounded"></div>
                ) : (
                  <p className="text-lg font-bold">
                    {item.cantidad} <span className="text-xs font-normal">({formatCurrency(item.total)})</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="pagos" className="flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1">
            <Terminal className="w-4 h-4" />
            Webhook Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagos">
      <Card>
        <CardHeader className="p-3 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pagos Recibidos</CardTitle>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="approved">Aprobado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="rejected">Rechazado</SelectItem>
                <SelectItem value="refunded">Reintegrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">ID</th>
                  <th className="text-left py-2 px-2 font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 font-medium">Monto</th>
                  <th className="text-left py-2 px-2 font-medium">Estado</th>
                  <th className="text-left py-2 px-2 font-medium">Método</th>
                  <th className="text-left py-2 px-2 font-medium">Referencia</th>
                  <th className="text-left py-2 px-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pagos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-muted-foreground">
                      No hay pagos registrados
                    </td>
                  </tr>
                ) : (
                  pagos.map((pago) => (
                    <tr key={pago.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-mono text-xs">{pago.mercadopago_id}</td>
                      <td className="py-2 px-2">
                        {pago.fecha_pago ? format(new Date(pago.fecha_pago), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}
                      </td>
                      <td className="py-2 px-2 font-medium">
                        {formatCurrency(pago.amount, pago.currency)}
                      </td>
                      <td className="py-2 px-2">{getStatusBadge(pago.status)}</td>
                      <td className="py-2 px-2 text-xs">
                        {pago.payment_type === 'account_money' && 'Dinero en cuenta'}
                        {pago.payment_type === 'credit_card' && `Tarjeta (****${pago.card_last_four})`}
                        {pago.payment_type === 'debit_card' && `Débito (****${pago.card_last_four})`}
                        {!pago.payment_type && '-'}
                      </td>
                      <td className="py-2 px-2 text-xs truncate max-w-32">
                        {pago.external_reference || pago.description || '-'}
                      </td>
                      <td className="py-2 px-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedPago(pago)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {pagination.pages > 1 && (
            <div className="mt-3">
              <Pagination
                page={pagination.page}
                pages={pagination.pages}
                has_next={pagination.has_next}
                has_prev={pagination.has_prev}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader className="p-3 pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Logs de Webhook</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchWebhookLogs}
                  disabled={loadingLogs}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {loadingLogs ? (
                <div className="animate-pulse space-y-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              ) : webhookLogs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No hay logs de webhooks registrados
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {webhookLogs.map((log) => (
                    <div key={log.id} className="p-2 bg-muted rounded text-xs font-mono">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">
                          {log.fecha ? format(new Date(log.fecha), 'dd/MM/yyyy HH:mm:ss', { locale: es }) : 'Sin fecha'}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {log.topic}
                        </span>
                      </div>
                      {log.payload_resumen && (
                        <div className="text-muted-foreground">
                          <div>Action: {log.payload_resumen.action}</div>
                          <div>Data ID: {log.payload_resumen.data_id || 'N/A'}</div>
                          <div>User ID: {log.payload_resumen.user_id}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedPago && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[80vh] overflow-y-auto">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Detalle del Pago</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPago(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">ID Mercadopago:</span>
                  <p className="font-mono">{selectedPago.mercadopago_id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <div className="mt-1">{getStatusBadge(selectedPago.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Monto:</span>
                  <p className="font-bold text-lg">{formatCurrency(selectedPago.amount, selectedPago.currency)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo de pago:</span>
                  <p>{selectedPago.payment_type || '-'}</p>
                </div>
                {selectedPago.card_last_four && (
                  <div>
                    <span className="text-muted-foreground">Tarjeta:</span>
                    <p>**** {selectedPago.card_last_four}</p>
                  </div>
                )}
                {selectedPago.card_holder_name && (
                  <div>
                    <span className="text-muted-foreground">Titular:</span>
                    <p>{selectedPago.card_holder_name}</p>
                  </div>
                )}
                {selectedPago.payer_email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p>{selectedPago.payer_email}</p>
                  </div>
                )}
                {selectedPago.payer_identificacion_numero && (
                  <div>
                    <span className="text-muted-foreground">DNI:</span>
                    <p>{selectedPago.payer_identificacion_numero}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Fecha creación:</span>
                  <p>{selectedPago.fecha_creacion ? format(new Date(selectedPago.fecha_creacion), 'dd/MM/yyyy HH:mm:ss', { locale: es }) : '-'}</p>
                </div>
                {selectedPago.fecha_aprobacion && (
                  <div>
                    <span className="text-muted-foreground">Fecha aprobación:</span>
                    <p>{format(new Date(selectedPago.fecha_aprobacion), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</p>
                  </div>
                )}
                {selectedPago.external_reference && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Referencia externa:</span>
                    <p>{selectedPago.external_reference}</p>
                  </div>
                )}
                {selectedPago.description && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Descripción:</span>
                    <p>{selectedPago.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Mercadopago;
