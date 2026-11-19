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
      const params = soloMisDatos ? '?soloMisDatos=true' : '';
      const response = await apiGet(`${API}/dashboard/stats${params}`);
      setStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, [soloMisDatos]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, soloMisDatos]);

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
    return <div className="vpm-dashboard py-12 text-center text-muted-foreground">Cargando...</div>;
  }

  const mediosPago = Object.entries(stats.ventas_por_medio_pago || {});
  const totalMedios = mediosPago.reduce((acc, [, total]) => acc + (Number(total) || 0), 0);
  const deudores = stats.ultimos_clientes_cta_cte || [];
  const maxDeuda = Math.max(...deudores.map((c) => Math.abs(Number(c.saldo) || 0)), 1);
  const balance = (Number(stats.caja_real) || 0) - (Number(stats.total_egresos_hoy) || 0);

  const hoy = new Date();
  const fechaTexto = hoy.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const saludo = hoy.getHours() < 12 ? 'Buen día' : hoy.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.nombre?.trim().split(' ')[0] || 'usuario';

  const colorSufijo = (medio) =>
    ['efectivo', 'transferencia', 'posnet'].includes(medio) ? medio : 'cobros';
  const dotClass = (medio) => `vpm-legend-dot vpm-legend-dot--${colorSufijo(medio)}`;

  return (
    <div className="vpm-dashboard space-y-8">
      <div className="vpm-page-head">
        <div>
          <p className="vpm-eyebrow">{fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}</p>
          <h1 className="vpm-hello">{saludo}, <em>{firstName}</em></h1>
          <p className="vpm-sub">Resumen de ventas del día</p>
        </div>
        <div className="vpm-head-actions">
          {soloMisDatos && (
            <span className="vpm-chip vpm-chip--mine"><i aria-hidden="true" />Solo mis datos</span>
          )}
          <span className="vpm-chip"><i aria-hidden="true" />Caja abierta</span>
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-label="Ajustes del escritorio"
              aria-expanded={settingsOpen}
              className="vpm-icon-btn"
            >
              <Settings className="w-5 h-5" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 mt-2 w-72 p-4 vpm-settings-pop">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Solo mis datos</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mostrar solo ventas y egresos registrados por vos
                    </p>
                  </div>
                  <Switch
                    checked={soloMisDatos}
                    onCheckedChange={handleSoloMisDatosChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="vpm-kpi-grid dashboard-stats-grid">
        <Card
          data-testid="card-balance-del-dia"
          className="vpm-kpi-card vpm-kpi-balance"
          onClick={() => navigate('/dashboard')}
        >
          <CardHeader className="vpm-kpi-card-head">
            <CardTitle className="vpm-kpi-title">Balance del Día</CardTitle>
            <span className="vpm-kpi-icon"><DollarSign className="w-5 h-5" /></span>
          </CardHeader>
          <CardContent className="vpm-kpi-content">
            <div className={`vpm-kpi-value ${balance >= 0 ? '' : 'is-negative'}`}>
              {formatCurrency(balance, showCents)}
            </div>
            {totalMedios > 0 && (
              <div className="vpm-split" aria-hidden="true">
                {mediosPago.map(([medio, total]) => (
                  <span key={medio} style={{ flex: Number(total) || 0 }} className={`vpm-split-part vpm-split-part--${colorSufijo(medio)}`} />
                ))}
              </div>
            )}
            <div className="vpm-legend-wrap">
              <div className="vpm-legend">
                <div className="vpm-legend-row">
                  <i className="vpm-legend-dot vpm-legend-dot--efectivo" />
                  <span>Efectivo</span>
                  <span>{formatCurrency(stats.ventas_por_medio_pago?.efectivo || 0, showCents)}</span>
                </div>
                <div className="vpm-legend-row">
                  <i className="vpm-legend-dot vpm-legend-dot--transferencia" />
                  <span>Transferencia</span>
                  <span>{formatCurrency(stats.ventas_por_medio_pago?.transferencia || 0, showCents)}</span>
                </div>
                <div className="vpm-legend-row">
                  <i className="vpm-legend-dot vpm-legend-dot--posnet" />
                  <span>PosNet</span>
                  <span>{formatCurrency(stats.ventas_por_medio_pago?.posnet || 0, showCents)}</span>
                </div>
                {stats.ingresos_cta_cte_hoy > 0 && (
                  <div className="vpm-legend-row">
                    <i className="vpm-legend-dot vpm-legend-dot--cobros" />
                    <span>Cobros Cta. Cte.</span>
                    <span>{formatCurrency(stats.ingresos_cta_cte_hoy, showCents)}</span>
                  </div>
                )}
                <div className="vpm-legend-row vpm-legend-row--out">
                  <i className="vpm-legend-dot vpm-legend-dot--egresos" />
                  <span>Egresos</span>
                  <span>-{formatCurrency(stats.total_egresos_hoy || 0, showCents)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          data-testid="card-total-vendido"
          className="vpm-kpi-card vpm-kpi-sold"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <CardHeader className="vpm-kpi-card-head">
            <CardTitle className="vpm-kpi-title">Total Vendido Hoy</CardTitle>
            <span className="vpm-kpi-icon"><DollarSign className="w-5 h-5" /></span>
          </CardHeader>
          <CardContent className="vpm-kpi-content">
            <div className="vpm-kpi-value">{formatCurrency(stats.total_vendido_hoy, showCents)}</div>
            {mediosPago.length > 0 && (
              <div className="vpm-legend">
                {mediosPago.map(([medio, total]) => (
                  <div key={medio} className="vpm-legend-row">
                    <i className={dotClass(medio)} />
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
          className="vpm-kpi-card vpm-kpi-out"
          onClick={() => navigate('/egresos?filter=today')}
        >
          <CardHeader className="vpm-kpi-card-head">
            <CardTitle className="vpm-kpi-title">Total Egresos Hoy</CardTitle>
            <span className="vpm-kpi-icon"><TrendingDown className="w-5 h-5" /></span>
          </CardHeader>
          <CardContent className="vpm-kpi-content">
            <div className="vpm-kpi-value is-negative">
              {formatCurrency(stats.total_egresos_hoy, showCents)}
            </div>
          </CardContent>
          <span className="vpm-go"><ArrowRight /></span>
        </Card>

        <Card
          data-testid="card-cantidad-ventas"
          className="vpm-kpi-card vpm-kpi-sales"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <CardHeader className="vpm-kpi-card-head">
            <CardTitle className="vpm-kpi-title">Ventas Realizadas</CardTitle>
            <span className="vpm-kpi-icon"><ShoppingCart className="w-5 h-5" /></span>
          </CardHeader>
          <CardContent className="vpm-kpi-content">
            <div className="vpm-kpi-value">{formatNumber(stats.cantidad_ventas_hoy, false)}</div>
          </CardContent>
          <span className="vpm-go"><ArrowRight /></span>
        </Card>

        <Card
          data-testid="card-saldo-cuenta-corriente"
          className="vpm-kpi-card vpm-kpi-debt"
          onClick={() => navigate('/clientes')}
        >
          <CardHeader className="vpm-kpi-card-head">
            <CardTitle className="vpm-kpi-title">Saldo Cta. Cte.</CardTitle>
            <span className="vpm-kpi-icon"><Users className="w-5 h-5" /></span>
          </CardHeader>
          <CardContent className="vpm-kpi-content">
            <div className="vpm-kpi-value">
              {formatCurrency(stats.total_saldo_cuenta_corriente, showCents)}
            </div>
            {deudores.length > 0 && (
              <ul className="vpm-debtors">
                {deudores.map((cliente, idx) => (
                  <li key={idx} className="vpm-debtor-row">
                    <span className="vpm-debtor-name">{cliente.cliente_nombre}</span>
                    <span className="vpm-debtor-amt">{formatCurrency(cliente.saldo, showCents)}</span>
                    <span className="vpm-debtor-bar">
                      <span style={{ width: `${Math.max(4, (Math.abs(Number(cliente.saldo) || 0) / maxDeuda) * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
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
    </div>
  );
};

export default Dashboard;
