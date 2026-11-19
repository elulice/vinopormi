import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, CreditCard, Settings } from 'lucide-react';
import { toast } from 'sonner';
import '@/components/Dashboard.css';
import { formatCurrency, formatNumber } from '@/lib/currency';
import StickyNotesContainer from '@/components/StickyNotesContainer';
import { API } from '@/lib/config';
import { apiGet, apiPut } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Íconos del mockup v4 (mismo trazo y tamaño que en el HTML compartido).
const IconDollar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconTrendingUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 7-8.5 8.5-5-5L2 17" />
    <path d="M16 7h6v6" />
  </svg>
);
const IconTrendingDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 17-8.5-8.5-5 5L2 7" />
    <path d="M16 17h6v-6" />
  </svg>
);
const IconCart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="20" r="1.3" />
    <circle cx="18" cy="20" r="1.3" />
    <path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21.5 8H6" />
  </svg>
);

const MEDIOS_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  posnet: 'PosNet',
  cuenta_corriente: 'Cta. Cte.',
  mercadopago: 'MercadoPago'
};

const medioLabel = (medio = '') =>
  String(medio)
    .split(' + ')
    .map((m) => MEDIOS_LABELS[m] || m.replace(/_/g, ' '))
    .join(' + ');

const horaVenta = (fecha) => {
  try {
    return format(new Date(fecha), 'dd/MM HH:mm', { locale: es });
  } catch {
    return '—';
  }
};

const Dashboard = () => {
  const { getAuthHeader, user } = useAuth();
  const { showCents } = useConfig();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const [soloMisDatos, setSoloMisDatos] = useState(false);
  const [stats, setStats] = useState({
    total_vendido_hoy: 0,
    total_vendido_ayer: 0,
    cantidad_ventas_hoy: 0,
    ventas_por_medio_pago: {},
    total_saldo_cuenta_corriente: 0,
    total_egresos_hoy: 0,
    ingresos_cta_cte_hoy: 0,
    caja_real: 0,
    ultimos_clientes_cta_cte: [],
    ultimas_ventas: []
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
  const ultimasVentas = stats.ultimas_ventas || [];
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

  // Contexto para "Balance del día": evolución de ventas vs. ayer y ticket promedio.
  const ventasHoy = Number(stats.total_vendido_hoy) || 0;
  const ventasAyer = Number(stats.total_vendido_ayer) || 0;
  const deltaAyer = ventasAyer > 0 ? ((ventasHoy - ventasAyer) / ventasAyer) * 100 : null;
  const ticketPromedio = stats.cantidad_ventas_hoy > 0 ? ventasHoy / stats.cantidad_ventas_hoy : 0;

  // Barra de medios proporcional (antes era un único bloque gris decorativo).
  const splitPartes = [
    ...mediosPago.map(([medio, total]) => ({
      key: medio,
      valor: Math.abs(Number(total) || 0),
      cls: `vpm-split-part--${colorSufijo(medio)}`
    })),
    {
      key: 'egresos',
      valor: Math.abs(Number(stats.total_egresos_hoy) || 0),
      cls: 'vpm-split-part--egresos'
    }
  ].filter((p) => p.valor > 0);
  const splitTotal = splitPartes.reduce((acc, p) => acc + p.valor, 0);

  return (
    <div className="vpm-dashboard space-y-8">
      <div className="vpm-page-head">
        <div>
          <p className="vpm-eyebrow">{fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}</p>
          <h1 className="vpm-hello">{saludo}, <em>{firstName}</em></h1>
        </div>
        <div className="vpm-head-actions">
          <span className="vpm-chip"><i aria-hidden="true" />Caja abierta</span>
          {soloMisDatos && (
            <span className="vpm-chip vpm-chip--mine"><i aria-hidden="true" />Solo mis datos</span>
          )}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-label="Ajustes del escritorio"
              aria-expanded={settingsOpen}
              className="vpm-icon-btn vpm-gear-btn"
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

      <section className="vpm-kpi-grid dashboard-stats-grid" aria-label="Resumen del día">
        <article className="vpm-card vpm-balance" data-testid="card-balance-del-dia">
          <div className="vpm-card-head">
            <h2 className="vpm-card-title">Balance del día</h2>
            <span className="vpm-card-ico" aria-hidden="true"><IconDollar /></span>
          </div>
          <p className="vpm-value vpm-num"><small>$</small>{formatNumber(balance, showCents)}</p>
          <div className="vpm-balance-meta">
            <span className={`vpm-balance-delta ${deltaAyer === null ? '' : deltaAyer >= 0 ? 'is-pos' : 'is-neg'}`}>
              {deltaAyer === null
                ? 'Sin ventas ayer'
                : `${deltaAyer >= 0 ? '↗' : '↘'} ${Math.abs(deltaAyer).toFixed(0)}% vs. ayer`}
            </span>
            <span className="vpm-balance-ticket">Venta prom. <b className="vpm-num">{formatCurrency(ticketPromedio, showCents)}</b></span>
          </div>
          {totalMedios === 0 && (
            <p className="vpm-empty-line">Todavía no se registraron movimientos hoy.</p>
          )}
          <div className="vpm-legend-wrap">
            <div className="vpm-split" aria-hidden="true">
              {splitTotal > 0 ? (
                splitPartes.map((p) => (
                  <span key={p.key} className={p.cls} style={{ flex: p.valor / splitTotal }} />
                ))
              ) : (
                <span style={{ flex: 1, background: 'rgba(255,255,255,.06)' }} />
              )}
            </div>
            <div className="vpm-legend">
              <div><i style={{ background: 'var(--vpm-text)' }} />Efectivo<b className="vpm-num">{formatCurrency(stats.ventas_por_medio_pago?.efectivo || 0, showCents)}</b></div>
              <div><i style={{ background: 'var(--vpm-accent)' }} />Transferencia<b className="vpm-num">{formatCurrency(stats.ventas_por_medio_pago?.transferencia || 0, showCents)}</b></div>
              <div><i style={{ background: 'var(--vpm-faint)' }} />PosNet<b className="vpm-num">{formatCurrency(stats.ventas_por_medio_pago?.posnet || 0, showCents)}</b></div>
              <div className="vpm-out"><i style={{ background: 'var(--vpm-neg)' }} />Egresos<b className="vpm-num">−{formatCurrency(stats.total_egresos_hoy || 0, showCents)}</b></div>
            </div>
          </div>
        </article>

        <button
          type="button"
          data-testid="card-total-vendido"
          className="vpm-card vpm-link vpm-kpi-sold"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <div className="vpm-card-head">
            <h2 className="vpm-card-title">Total vendido hoy</h2>
            <span className="vpm-card-ico" aria-hidden="true"><IconTrendingUp /></span>
          </div>
          <p className="vpm-value vpm-num"><small>$</small>{formatNumber(stats.total_vendido_hoy, showCents)}</p>
          <p className="vpm-hint">Ayer: {formatCurrency(stats.total_vendido_ayer, showCents)}</p>
          <span className="vpm-go">Ver ventas <span className="vpm-dot"><ArrowRight /></span></span>
        </button>

        <button
          type="button"
          data-testid="card-total-egresos"
          className="vpm-card vpm-link vpm-kpi-out"
          onClick={() => navigate('/egresos?filter=today')}
        >
          <div className="vpm-card-head">
            <h2 className="vpm-card-title">Egresos hoy</h2>
            <span className="vpm-card-ico" aria-hidden="true"><IconTrendingDown /></span>
          </div>
          <p className="vpm-value vpm-num"><small>$</small>{formatNumber(stats.total_egresos_hoy, showCents)}</p>
          {!stats.total_egresos_hoy && <p className="vpm-hint">Sin egresos cargados</p>}
          <span className="vpm-go">Ver listado <span className="vpm-dot"><ArrowRight /></span></span>
        </button>

        <button
          type="button"
          data-testid="card-cantidad-ventas"
          className="vpm-card vpm-link vpm-kpi-sales"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <div className="vpm-card-head">
            <h2 className="vpm-card-title">Ventas realizadas</h2>
            <span className="vpm-card-ico" aria-hidden="true"><IconCart /></span>
          </div>
          <p className="vpm-value vpm-num">{formatNumber(stats.cantidad_ventas_hoy, false)}</p>
          {ultimasVentas.length > 0 ? (
            <ul className="vpm-last-sales" aria-label="Últimas ventas de hoy">
              {ultimasVentas.map((venta) => (
                <li key={venta.id || venta.fecha} className="vpm-last-sale">
                  <span className="vpm-last-sale-time">{horaVenta(venta.fecha)}</span>
                  <span className="vpm-last-sale-medio">{medioLabel(venta.medio_pago)}</span>
                  <span className="vpm-last-sale-total">{formatCurrency(venta.total, showCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vpm-hint">Sin ventas registradas hoy.</p>
          )}
          <span className="vpm-go">Ver listado <span className="vpm-dot"><ArrowRight /></span></span>
        </button>

        <button
          type="button"
          data-testid="card-saldo-cuenta-corriente"
          className="vpm-card vpm-link vpm-debt"
          onClick={() => navigate('/clientes')}
        >
          <div className="vpm-card-head">
            <h2 className="vpm-card-title">Ctas. Ctes.</h2>
            <span className="vpm-debt-tag">{deudores.length}</span>
          </div>
          <p className="vpm-value vpm-num"><small>$</small>{formatNumber(Math.abs(stats.total_saldo_cuenta_corriente || 0), showCents)}</p>
          {deudores.length > 0 && (
            <ul className="vpm-debtors">
              {deudores.map((cliente, idx) => (
                <li key={idx}>
                  <span className="vpm-name">{cliente.cliente_nombre}</span>
                  <span className="vpm-amt vpm-num">{formatCurrency(Math.abs(Number(cliente.saldo) || 0), showCents)}</span>
                  <span className="vpm-bar"><span style={{ width: `${Math.max(4, (Math.abs(Number(cliente.saldo) || 0) / maxDeuda) * 100)}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
          <span className="vpm-go">Ver cuentas <span className="vpm-dot"><ArrowRight /></span></span>
        </button>
      </section>

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
