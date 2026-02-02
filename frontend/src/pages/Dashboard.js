import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, CreditCard, Users, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import '@/components/Dashboard.css';
import { formatCurrency, formatNumber } from '@/lib/currency';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { getAuthHeader } = useAuth();
  const [stats, setStats] = useState({
    total_vendido_hoy: 0,
    cantidad_ventas_hoy: 0,
    ventas_por_medio_pago: {},
    total_saldo_cuenta_corriente: 0,
    total_egresos_hoy: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`, {
        headers: getAuthHeader()
      });
      setStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const mediosPago = Object.entries(stats.ventas_por_medio_pago);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de ventas del día</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 dashboard-stats-grid">
        <Card data-testid="card-total-vendido">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Vendido Hoy
            </CardTitle>
            <DollarSign className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-foreground break-words overflow-wrap-anywhere">
              {formatCurrency(stats.total_vendido_hoy)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-egresos">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Egresos Hoy
            </CardTitle>
            <TrendingDown className="w-5 h-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-destructive break-words overflow-wrap-anywhere">
              {formatCurrency(stats.total_egresos_hoy)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-balance-del-dia">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance del Día
            </CardTitle>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl sm:text-3xl font-bold ${(stats.total_vendido_hoy - stats.total_egresos_hoy) >= 0 ? 'text-green-600' : 'text-destructive'} break-words overflow-wrap-anywhere`}>
              {formatCurrency(stats.total_vendido_hoy - stats.total_egresos_hoy)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-cantidad-ventas">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ventas Realizadas
            </CardTitle>
            <ShoppingCart className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-foreground break-words overflow-wrap-anywhere">
              {stats.cantidad_ventas_hoy}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-saldo-cuenta-corriente">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Cta. Cte.
            </CardTitle>
            <Users className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-orange-600 break-words overflow-wrap-anywhere">
              {formatCurrency(stats.total_saldo_cuenta_corriente)}
            </div>
          </CardContent>
        </Card>
      </div>

      {mediosPago.length > 0 && (
        <Card data-testid="card-ventas-por-medio">
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
                      {formatCurrency(total)}
                   </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;