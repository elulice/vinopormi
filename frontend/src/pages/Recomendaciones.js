import { useState, useCallback, useEffect, useRef } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  PackagePlus, 
  AlertTriangle, 
  Loader2,
  Trophy
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { API } from '@/lib/config';
import { apiGet } from '@/lib/api';

const Recomendaciones = () => {
  const { showCents } = useConfig();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialFetchDone = useRef(false);

  const fetchRecomendaciones = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      if (!loading) setRefreshing(true);
      else setLoading(true);
    }
    try {
      const res = await apiGet(`${API}/recomendaciones`);
      setData(res.data);
    } catch (error) {
      console.error('Error al obtener recomendaciones:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchRecomendaciones(true);
    }
  }, [fetchRecomendaciones]);

  const hasData = data && (
    (Array.isArray(data.top_productos) && data.top_productos.length > 0) ||
    (Array.isArray(data.a_reponer) && data.a_reponer.length > 0) ||
    (Array.isArray(data.exceso_stock) && data.exceso_stock.length > 0)
  );

  const formatearCobertura = (dias) => {
    if (dias >= 999) return 'Sin ventas';
    if (!isFinite(dias)) return 'Sin ventas';
    if (dias >= 90) return `> 3 meses`;
    if (dias >= 30) return `~${Math.round(dias)} días`;
    return `${Math.round(dias)} días`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Sparkles className="w-6 h-6 text-primary" />
            Recomendaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Insights de ventas y stock según la velocidad de venta de los últimos {data?.periodo_dias || 30} días.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRecomendaciones(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      {(loading || refreshing) && !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !hasData ? (
        <Card className="py-8">
          <CardContent className="flex flex-col items-center justify-center text-center py-8">
            <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              Aún no hay datos suficientes para generar recomendaciones.
            </p>
            <p className="text-sm text-muted-foreground">
              Registrá ventas para ver los productos más vendidos y sugerencias de reposición.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* TOP PRODUCTOS */}
          <Card className="py-2">
            <CardHeader className="py-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Productos más vendidos
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {!data.top_productos || data.top_productos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.top_productos.map((p, i) => (
                    <li key={p.producto_id || i} className="flex items-center justify-between gap-2 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${
                          i === 0
                            ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400'
                            : i === 1
                            ? 'bg-gray-400/20 text-gray-500 dark:text-gray-300'
                            : i === 2
                            ? 'bg-orange-400/20 text-orange-600 dark:text-orange-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="font-medium truncate">{p.nombre}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm text-muted-foreground">{p.unidades} unid.</span>
                        <span className="text-sm font-semibold">{formatCurrency(p.monto, showCents)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* A REPONER */}
          <Card className="py-2 border-red-200 dark:border-red-400/40">
            <CardHeader className="py-2">
              <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-400">
                <PackagePlus className="w-4 h-4" />
                Sugerencias de reposición
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {!data.a_reponer || data.a_reponer.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay productos que requieran reposición urgente.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground text-xs">
                        <th className="pb-2 pr-2 font-medium sticky top-0 bg-card">Producto</th>
                        <th className="pb-2 pr-2 font-medium text-right sticky top-0 bg-card">Stock</th>
                        <th className="pb-2 pr-2 font-medium text-right sticky top-0 bg-card">Vel./día</th>
                        <th className="pb-2 pr-2 font-medium text-right sticky top-0 bg-card">Cobertura</th>
                        <th className="pb-2 font-medium text-right sticky top-0 bg-card">Sugerido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.a_reponer.map((r) => (
                        <tr key={r.producto_id}>
                          <td className="py-2 pr-2 font-medium">{r.nombre}</td>
                          <td className="py-2 pr-2 text-right">{r.stock_actual}</td>
                          <td className="py-2 pr-2 text-right">{r.velocidad_diaria} u/d</td>
                          <td className="py-2 pr-2 text-right">{formatearCobertura(r.dias_cobertura)}</td>
                          <td className="py-2 text-right font-semibold text-red-600 dark:text-red-400">
                            {r.cantidad_sugerida} u
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* EXCESO DE STOCK */}
          <Card className="py-2 border-amber-200 dark:border-amber-400/40">
            <CardHeader className="py-2">
              <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                Exceso de stock / baja rotación
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {!data.exceso_stock || data.exceso_stock.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay productos con exceso de stock relevante.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground text-xs">
                        <th className="pb-2 pr-2 font-medium">Producto</th>
                        <th className="pb-2 pr-2 font-medium text-right">Stock</th>
                        <th className="pb-2 pr-2 font-medium text-right">Vendidos 30d</th>
                        <th className="pb-2 font-medium text-right">Cobertura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.exceso_stock.map((e) => (
                        <tr key={e.producto_id}>
                          <td className="py-2 pr-2 font-medium">{e.nombre}</td>
                          <td className="py-2 pr-2 text-right">{e.stock_actual}</td>
                          <td className="py-2 pr-2 text-right">{e.unidades_vendidas_30d}</td>
                          <td className="py-2 text-right">{formatearCobertura(e.dias_cobertura)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Cálculo basado en la velocidad de venta de los últimos {data?.periodo_dias || 30} días (inteligencia por reglas, sin conexión externa).
      </p>
    </div>
  );
};

export default Recomendaciones;