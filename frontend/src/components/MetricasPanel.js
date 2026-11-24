import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Info, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SkeletonTable } from '@/components/Skeleton';
import { apiGet } from '@/lib/api';
import { useDataRefresh } from '@/lib/dataEvents';
import { API } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const fmtMoneyAR = (n) =>
  '$ ' + Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtHoras = (n) => `${Number(n || 0).toFixed(2)} h`;

const fmtFecha = (ymd) => {
  const texto = String(ymd || '');
  const partes = texto.split('-');
  if (partes.length !== 3) return texto;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const ORDENES = [
  { clave: 'score', etiqueta: 'Score' },
  { clave: 'cantidad_ventas', etiqueta: 'Cantidad de ventas' },
  { clave: 'monto_total', etiqueta: 'Monto vendido' },
  { clave: 'horas_trabajadas', etiqueta: 'Horas trabajadas' },
  { clave: 'dias_activos', etiqueta: 'Días activos' },
  { clave: 'cantidad_auditorias', etiqueta: 'Acciones de auditoría' },
];

const AGRUPACIONES = [
  { clave: 'dia', etiqueta: 'Por día' },
  { clave: 'semana', etiqueta: 'Por semana' },
  { clave: 'mes', etiqueta: 'Por mes' },
  { clave: 'total', etiqueta: 'Total del período' },
];

const RANGOS = [
  { clave: '7', etiqueta: '7 días' },
  { clave: '30', etiqueta: '30 días' },
  { clave: 'mes', etiqueta: 'Este mes' },
  { clave: 'custom', etiqueta: 'Personalizado' },
];

// Convertimos cualquier Date a YYYY-MM-DD en hora Argentina (UTC-3), igual
// que el criterio que usa el backend para agrupar los eventos por día.
const ymdAR = (fecha) =>
  new Date(fecha.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

const fechaAR = () => {
  const [anio, mes, dia] = ymdAR(new Date()).split('-').map(Number);
  return { anio, mes, dia, hoy: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` };
};

const restarDias = (anio, mes, dia, n) =>
  new Date(Date.UTC(anio, mes - 1, dia - n)).toISOString().slice(0, 10);

function TablaVacia({ mensaje }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {mensaje || 'No hay datos registrados en el rango seleccionado.'}
    </div>
  );
}

/** Tabla compacta que se muestra debajo de la respuesta del chat cuando el IA
 *  consultó una herramienta de métricas. Recibe el objeto `data` del endpoint. */
export function MetricasResumen({ dato }) {
  if (!dato?.datos) return null;
  const datos = dato.datos;
  const tipo = dato.tipo || datos.tipo;

  if (tipo === 'ranking') {
    const filas = datos.ranking || [];
    if (!filas.length) return <TablaVacia />;
    return (
      <div className="mt-2 overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-muted/70">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold border-b border-border">#</th>
              <th className="px-2 py-1.5 text-left font-semibold border-b border-border">Empleado</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Ventas</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Monto</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Horas</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Score</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.usuario_id} className="odd:bg-muted/20">
                <td className="px-2 py-1.5 border-b border-border">{f.puesto}</td>
                <td className="px-2 py-1.5 border-b border-border font-medium">{f.nombre}</td>
                <td className="px-2 py-1.5 border-b border-border text-right">{f.cantidad_ventas}</td>
                <td className="px-2 py-1.5 border-b border-border text-right whitespace-nowrap">{fmtMoneyAR(f.monto_total)}</td>
                <td className="px-2 py-1.5 border-b border-border text-right whitespace-nowrap">{fmtHoras(f.horas_trabajadas)}</td>
                <td className="px-2 py-1.5 border-b border-border text-right font-semibold">{f.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tipo === 'tiempo') {
    const filas = datos.usuarios || [];
    if (!filas.length) return <TablaVacia />;
    return (
      <div className="mt-2 overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-muted/70">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold border-b border-border">Empleado</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Horas</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Días</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Promedio</th>
              <th className="px-2 py-1.5 text-right font-semibold border-b border-border">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((u) => (
              <tr key={u.usuario_id} className="odd:bg-muted/20">
                <td className="px-2 py-1.5 border-b border-border font-medium">{u.nombre}</td>
                <td className="px-2 py-1.5 border-b border-border text-right whitespace-nowrap">{fmtHoras(u.total_horas)}</td>
                <td className="px-2 py-1.5 border-b border-border text-right">{u.dias_activos}</td>
                <td className="px-2 py-1.5 border-b border-border text-right whitespace-nowrap">{fmtHoras(u.promedio_horas_dia)}</td>
                <td className="px-2 py-1.5 border-b border-border text-right whitespace-nowrap">{fmtMoneyAR(u.monto_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

const MetricasPanel = () => {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const [vista, setVista] = useState('tiempo');
  const [rango, setRango] = useState('30');
  const hoy = useMemo(() => fechaAR(), []);
  const [desdeCustom, setDesdeCustom] = useState(restarDias(hoy.anio, hoy.mes, hoy.dia, 29));
  const [hastaCustom, setHastaCustom] = useState(hoy.hoy);
  const [agrupar, setAgrupar] = useState('dia');
  const [ordenarPor, setOrdenarPor] = useState('score');
  const [ascendente, setAscendente] = useState(false);
  const [pesos, setPesos] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandidos, setExpandidos] = useState({});

  const periodo = useMemo(() => {
    if (rango === 'custom') {
      const desde = desdeCustom || hoy.hoy;
      const hasta = hastaCustom || hoy.hoy;
      return { desde: desde <= hasta ? desde : hasta, hasta: desde <= hasta ? hasta : desde };
    }
    if (rango === '7') {
      return { desde: restarDias(hoy.anio, hoy.mes, hoy.dia, 6), hasta: hoy.hoy };
    }
    if (rango === 'mes') {
      return { desde: `${hoy.anio}-${String(hoy.mes).padStart(2, '0')}-01`, hasta: hoy.hoy };
    }
    return { desde: restarDias(hoy.anio, hoy.mes, hoy.dia, 29), hasta: hoy.hoy };
  }, [rango, desdeCustom, hastaCustom, hoy]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta });
      let url;
      if (vista === 'ranking') {
        params.set('ordenar_por', ordenarPor);
        params.set('ascendente', String(ascendente));
        if (pesos) params.set('pesos', pesos);
        url = `${API}/ia/metricas/ranking?${params}`;
      } else {
        params.set('agrupar', agrupar);
        url = `${API}/ia/metricas/tiempo-trabajado?${params}`;
      }
      const res = await apiGet(url);
      setData(res?.data || null);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudieron cargar las métricas.');
    } finally {
      setLoading(false);
    }
  }, [vista, periodo.desde, periodo.hasta, ordenarPor, ascendente, pesos, agrupar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useDataRefresh(['metricas'], cargar);

  const cambiarOrden = (clave) => {
    if (clave === ordenarPor) {
      setAscendente((a) => !a);
    } else {
      setOrdenarPor(clave);
      setAscendente(false);
    }
  };

  const encabezadoOrdenable = (clave, etiqueta, extra = '') => {
    const activo = ordenarPor === clave;
    const Icono = ascendente ? ArrowUp : ArrowDown;
    return (
      <th className={`px-3 py-2 border-b border-border whitespace-nowrap ${extra}`}>
        <button
          type="button"
          onClick={() => cambiarOrden(clave)}
          className={`inline-flex items-center gap-1 font-semibold transition-colors hover:text-primary ${
            activo ? 'text-primary' : ''
          }`}
          title={`Ordenar por ${etiqueta}`}
        >
          {etiqueta}
          {activo && <Icono className="w-3.5 h-3.5" />}
        </button>
      </th>
    );
  };

  const periodosDe = (u) => u?.por_periodo || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Rango:</span>
        {RANGOS.map((r) => (
          <button
            key={r.clave}
            type="button"
            onClick={() => setRango(r.clave)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              rango === r.clave
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
            }`}
          >
            {r.etiqueta}
          </button>
        ))}
        {rango === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <Input
              type="date"
              value={desdeCustom}
              max={hastaCustom}
              onChange={(e) => setDesdeCustom(e.target.value)}
              className="h-9 w-[9.5rem] text-sm"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="date"
              value={hastaCustom}
              min={desdeCustom}
              onChange={(e) => setHastaCustom(e.target.value)}
              className="h-9 w-[9.5rem] text-sm"
            />
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {fmtFecha(periodo.desde)} — {fmtFecha(periodo.hasta)}
        </span>
      </div>

      <Tabs value={vista} onValueChange={(v) => { setVista(v); setData(null); }}>
        <TabsList>
          <TabsTrigger value="tiempo">Tiempo trabajado</TabsTrigger>
          {esAdmin && (
            <TabsTrigger value="ranking">
              <Trophy className="w-4 h-4 mr-1.5" /> Ranking
            </TabsTrigger>
          )}
        </TabsList>

        <Card className="mt-3">
          <CardHeader className="py-3 border-b border-border flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              {vista === 'ranking' ? 'Ranking de empleados estrella' : 'Tiempo trabajado (estimado)'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={cargar} disabled={loading} title="Recargar métricas">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {vista === 'tiempo' && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <label className="text-sm text-muted-foreground" htmlFor="agrupar-tiempo">Agrupar:</label>
                <Select value={agrupar} onValueChange={setAgrupar}>
                  <SelectTrigger id="agrupar-tiempo" className="w-[13rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGRUPACIONES.map((a) => (
                      <SelectItem key={a.clave} value={a.clave}>{a.etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {esAdmin && (
                  <span className="text-xs text-muted-foreground">
                    Tocá un empleado para ver su desglose.
                  </span>
                )}
              </div>
            )}

            {vista === 'ranking' && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="inline-flex rounded-md border border-border overflow-hidden" role="group" aria-label="Dirección del orden">
                  <button
                    type="button"
                    onClick={() => setAscendente(false)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      !ascendente ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    Mejor → peor
                  </button>
                  <button
                    type="button"
                    onClick={() => setAscendente(true)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                      ascendente ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    Peor → mejor
                  </button>
                </div>
                <Select
                  value={ordenarPor}
                  onValueChange={(v) => { setOrdenarPor(v); setAscendente(false); }}
                >
                  <SelectTrigger className="w-[13rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDENES.map((o) => (
                      <SelectItem key={o.clave} value={o.clave}>{o.etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pesos || data?.pesos_preset || 'balanceado'} onValueChange={setPesos}>
                  <SelectTrigger className="w-[19rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.pesos_disponibles || []).map((p) => (
                      <SelectItem key={p.clave} value={p.clave}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading && !data ? (
              <SkeletonTable rows={5} columns={4} />
            ) : vista === 'tiempo' ? (
              (() => {
                const filas = data?.usuarios || [];
                if (!filas.length) return <TablaVacia />;
                return (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="min-w-full text-sm border-collapse">
                      <thead className="bg-muted/70">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold border-b border-border">Empleado</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-border">Horas</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-border">Días activos</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-border">Promedio</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-border">Ventas</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-border">Monto</th>
                          <th className="px-3 py-2 text-right font-semibold border-b border-border">Auditorías</th>
                          <th className="px-2 py-2 border-b border-border" />
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((u) => {
                          const abierto = !!expandidos[u.usuario_id];
                          const periodos = periodosDe(u);
                          return (
                            <Fragment key={u.usuario_id}>
                              <tr
                                className="odd:bg-muted/20 cursor-pointer hover:bg-muted/50"
                                onClick={() => setExpandidos((e) => ({ ...e, [u.usuario_id]: !abierto }))}
                              >
                                <td className="px-3 py-2 border-b border-border font-medium">
                                  <span className="inline-flex items-center gap-1.5">
                                    {u.nombre}
                                    {abierto ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                                  </span>
                                </td>
                                <td className="px-3 py-2 border-b border-border text-right whitespace-nowrap">{fmtHoras(u.total_horas)}</td>
                                <td className="px-3 py-2 border-b border-border text-right">{u.dias_activos}</td>
                                <td className="px-3 py-2 border-b border-border text-right whitespace-nowrap">{fmtHoras(u.promedio_horas_dia)}</td>
                                <td className="px-3 py-2 border-b border-border text-right">{u.cantidad_ventas}</td>
                                <td className="px-3 py-2 border-b border-border text-right whitespace-nowrap">{fmtMoneyAR(u.monto_total)}</td>
                                <td className="px-3 py-2 border-b border-border text-right">{u.cantidad_auditorias}</td>
                                <td className="px-2 py-2 border-b border-border" />
                              </tr>
                              {abierto && (
                                <tr className="bg-muted/30">
                                  <td colSpan={8} className="px-3 py-3 border-b border-border">
                                    {periodos.length ? (
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs border-collapse">
                                          <thead>
                                            <tr className="text-muted-foreground">
                                              <th className="px-2 py-1 text-left font-semibold">Período</th>
                                              <th className="px-2 py-1 text-right font-semibold">Horas</th>
                                              <th className="px-2 py-1 text-right font-semibold">Días</th>
                                              {periodos[0]?.inicio && <th className="px-2 py-1 text-left font-semibold">Inicio</th>}
                                              {periodos[0]?.fin && <th className="px-2 py-1 text-left font-semibold">Fin</th>}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {periodos.map((p) => (
                                              <tr key={p.periodo}>
                                                <td className="px-2 py-1">{p.periodo}</td>
                                                <td className="px-2 py-1 text-right whitespace-nowrap">{fmtHoras(p.horas)}</td>
                                                <td className="px-2 py-1 text-right">{p.dias}</td>
                                                {p.inicio && <td className="px-2 py-1">{p.inicio}</td>}
                                                {p.fin && <td className="px-2 py-1">{p.fin}</td>}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">Sin actividad registrada en el rango.</p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            ) : (
              (() => {
                const filas = data?.ranking || [];
                if (!filas.length) return <TablaVacia />;
                return (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="min-w-full text-sm border-collapse">
                      <thead className="bg-muted/70">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold border-b border-border">#</th>
                          <th className="px-3 py-2 text-left font-semibold border-b border-border">Empleado</th>
                          {encabezadoOrdenable('cantidad_ventas', 'Ventas', 'text-right')}
                          {encabezadoOrdenable('monto_total', 'Monto', 'text-right')}
                          {encabezadoOrdenable('horas_trabajadas', 'Horas', 'text-right')}
                          {encabezadoOrdenable('dias_activos', 'Días', 'text-right')}
                          {encabezadoOrdenable('cantidad_auditorias', 'Auditorías', 'text-right')}
                          {encabezadoOrdenable('score', 'Score', 'text-right')}
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f) => (
                          <tr key={f.usuario_id} className="odd:bg-muted/20">
                            <td className="px-3 py-2 border-b border-border font-semibold">{f.puesto}</td>
                            <td className="px-3 py-2 border-b border-border font-medium whitespace-nowrap">
                              {f.puesto === 1 && <Trophy className="inline w-4 h-4 mr-1 text-amber-500" />}
                              {f.nombre}
                            </td>
                            <td className="px-3 py-2 border-b border-border text-right">{f.cantidad_ventas}</td>
                            <td className="px-3 py-2 border-b border-border text-right whitespace-nowrap">{fmtMoneyAR(f.monto_total)}</td>
                            <td className="px-3 py-2 border-b border-border text-right whitespace-nowrap">{fmtHoras(f.horas_trabajadas)}</td>
                            <td className="px-3 py-2 border-b border-border text-right">{f.dias_activos}</td>
                            <td className="px-3 py-2 border-b border-border text-right">{f.cantidad_auditorias}</td>
                            <td className="px-3 py-2 border-b border-border text-right font-semibold">{f.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>

        {data?.metodo && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground px-1">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{data.metodo}</span>
          </p>
        )}
        {vista === 'ranking' && data?.broma && (
          <p className="text-xs text-muted-foreground px-1 italic">🏆 {data.broma}</p>
        )}
      </Tabs>
    </div>
  );
};

export default MetricasPanel;
