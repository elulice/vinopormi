import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { DollarSign, ShoppingCart, CreditCard, Users, TrendingDown, TrendingUp, ArrowRight, Settings } from 'lucide-react';
import { toast } from 'sonner';
import '@/components/Dashboard.css';
import { formatCurrency, formatNumber } from '@/lib/currency';
import StickyNotesContainer from '@/components/StickyNotesContainer';
import WelcomeModal from '@/components/WelcomeModal';
import { API } from '@/lib/config';
import { apiGet, apiPut } from '@/lib/api';

const Dashboard = () => {
  const { getAuthHeader, user } = useAuth();
  const { showCents } = useConfig();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const [soloMisDatos, setSoloMisDatos] = useState(false);
  const [stats, setStats] = useState({
    total_vendido_hoy: 0,
    cantidad_ventas_hoy: 0,
    ventas_por_medio_pago: {},
    total_saldo_cuenta_corriente: 0,
    total_egresos_hoy: 0,
    ingresos_cta_cte_hoy: 0,
    caja_real: 0,
    ultimos_clientes_cta_cte: []
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiGet(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const loadPreferencias = async () => {
      try {
        const res = await apiGet(`${API}/auth/preferencias`);
        setSoloMisDatos(res.data.soloMisDatos || false);
      } catch (error) {
        console.error('Error loading preferencias:', error);
      }
    };
    loadPreferencias();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSoloMisDatosChange = async (checked) => {
    try {
      await apiPut(`${API}/auth/preferencias`, 
        { soloMisDatos: checked }
      );
      setSoloMisDatos(checked);
      fetchStats();
    } catch (error) {
      toast.error('Error al guardar preferencia');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const mediosPago = Object.entries(stats.ventas_por_medio_pago);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Escritorio</h1>
          <p className="text-muted-foreground">Resumen de ventas del día</p>
        </div>
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-background border rounded-md shadow-lg p-3 z-50">
              <div className="flex items-center justify-between">
                <span className="text-sm">Solo mis datos</span>
                <Switch
                  checked={soloMisDatos}
                  onCheckedChange={handleSoloMisDatosChange}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mostrar solo ventas y egresos registrados por ti
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mt-3 !mt-3 dashboard-stats-grid">
        <Card 
          data-testid="card-total-vendido"
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Vendido Hoy
            </CardTitle>
            <DollarSign className="w-5 h-5 text-primary !mt-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground break-words overflow-wrap-anywhere pb-1">
              {formatCurrency(stats.total_vendido_hoy, showCents)}
            </div>
            {stats.ventas_por_medio_pago && Object.keys(stats.ventas_por_medio_pago).length > 0 && (
              <div className="space-y-1 pt-1">
                {Object.entries(stats.ventas_por_medio_pago).map(([medio, total]) => (
                  <div key={medio} className="flex justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{medio.replace('_', ' ')}</span>
                    <span>{formatCurrency(total, showCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          data-testid="card-total-egresos"
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/egresos?filter=today')}
        >
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Egresos Hoy
            </CardTitle>
            <TrendingDown className="w-5 h-5 text-destructive !mt-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-destructive break-words overflow-wrap-anywhere pb-8">
              {formatCurrency(stats.total_egresos_hoy, showCents)}
            </div>
          </CardContent>
          <div className="absolute bottom-3 right-3 bg-red-100 rounded-full p-2 hover:bg-red-200 transition-colors duration-200">
            <ArrowRight className="w-4 h-4 text-red-600" />
          </div>
        </Card>

        <Card
          data-testid="card-balance-del-dia"
          className="cursor-pointer relative hover:shadow-lg hover:z-50 hover:scale-x-[1.15] hover:scale-y-[1.08] transition-all duration-200 bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 hover:border-blue-400"
          onClick={() => navigate('/dashboard')}
        >
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance del Día
            </CardTitle>
            <DollarSign className="w-5 h-5 text-blue-600 !mt-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-2xl sm:text-2xl font-bold ${(stats.caja_real - stats.total_egresos_hoy) >= 0 ? 'text-green-600' : 'text-destructive'} break-words overflow-wrap-anywhere pb-2`}>
              {formatCurrency(stats.caja_real - stats.total_egresos_hoy, showCents)}
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-green-600">
                <span>Efectivo</span>
                <span>{formatCurrency(stats.ventas_por_medio_pago?.efectivo || 0, showCents)}</span>
              </div>
              <div className="flex justify-between text-xs text-green-600">
                <span>Transferencia</span>
                <span>{formatCurrency(stats.ventas_por_medio_pago?.transferencia || 0, showCents)}</span>
              </div>
              <div className="flex justify-between text-xs text-green-600">
                <span>PosNet</span>
                <span>{formatCurrency(stats.ventas_por_medio_pago?.posnet || 0, showCents)}</span>
              </div>
              {stats.ingresos_cta_cte_hoy > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Cobros Cta. Cte.</span>
                  <span>{formatCurrency(stats.ingresos_cta_cte_hoy, showCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-red-500 pt-1 border-t">
                <span>Egresos</span>
                <span>-{formatCurrency(stats.total_egresos_hoy, showCents)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          data-testid="card-cantidad-ventas"
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ventas Realizadas
            </CardTitle>
            <ShoppingCart className="w-5 h-5 text-primary !mt-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground break-words overflow-wrap-anywhere pb-8">
              {stats.cantidad_ventas_hoy}
            </div>
          </CardContent>
          <div className="absolute bottom-3 right-3 bg-purple-100 rounded-full p-2 hover:bg-purple-200 transition-colors duration-200">
            <ArrowRight className="w-4 h-4 text-purple-600" />
          </div>
        </Card>

        <Card 
          data-testid="card-saldo-cuenta-corriente"
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/clientes')}
        >
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground leading-none">
              Saldo Cta. Cte.
            </CardTitle>
            <Users className="w-5 h-5 text-orange-600 flex-shrink-0 !mt-0" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-orange-600 break-words overflow-wrap-anywhere pb-1">
              {formatCurrency(stats.total_saldo_cuenta_corriente, showCents)}
            </div>
            {stats.ultimos_clientes_cta_cte && stats.ultimos_clientes_cta_cte.length > 0 && (
              <div className="space-y-1 pt-1">
                {stats.ultimos_clientes_cta_cte.map((cliente, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[120px]">{cliente.cliente_nombre}</span>
                    <span className={cliente.saldo >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(cliente.saldo, showCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {mediosPago.length > 0 && (
        // Oculto el card, pero no lo elimino por si vuelvo a utilizarlo.
        // Los datos que estaban en ésta card ahora serán veisibles en el card de "Total Vendido Hoy"
        <Card data-testid="card-ventas-por-medio" className="hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Ventas por Medio de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mediosPago.map(([medio, total]) => (
                <div key={medio} className="flex justify-between items-center p-3 bg-muted rounded-md">
                  <span className="font-medium capitalize">
                    {medio.replace('_', ' ')}
                  </span>
                   <span className="text-base sm:text-lg font-semibold text-primary break-words overflow-wrap-anywhere">
                      {formatCurrency(total, showCents)}
                   </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky Notes Container */}
      <div className="!mt-3">
        <StickyNotesContainer />
      </div>

      {/* Modal de Bienvenida/Novedades */}
      <WelcomeModal />
    </div>
  );
};

export default Dashboard;
