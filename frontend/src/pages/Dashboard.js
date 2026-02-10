import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, CreditCard, Users, TrendingDown, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import '@/components/Dashboard.css';
import { formatCurrency, formatNumber } from '@/lib/currency';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { getAuthHeader } = useAuth();
  const { showCents } = useConfig();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_vendido_hoy: 0,
    cantidad_ventas_hoy: 0,
    ventas_por_medio_pago: {},
    total_saldo_cuenta_corriente: 0,
    total_egresos_hoy: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
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
  }, [getAuthHeader]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const mediosPago = Object.entries(stats.ventas_por_medio_pago);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Escritorio</h1>
        <p className="text-muted-foreground">Resumen de ventas del día</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 dashboard-stats-grid">
        <Card 
          data-testid="card-total-vendido"
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Vendido Hoy
            </CardTitle>
            <DollarSign className="w-5 h-5 text-primary !mt-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-foreground break-words overflow-wrap-anywhere pb-8">
              {formatCurrency(stats.total_vendido_hoy, showCents)}
            </div>
          </CardContent>
          <div className="absolute bottom-3 right-3 bg-blue-100 rounded-full p-2 hover:bg-blue-200 transition-colors duration-200">
            <ArrowRight className="w-4 h-4 text-blue-600" />
          </div>
        </Card>

        <Card 
          data-testid="card-total-egresos"
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/egresos?filter=today')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Egresos Hoy
            </CardTitle>
            <TrendingDown className="w-5 h-5 text-destructive !mt-0" />
          </CardHeader>
          <CardContent>
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
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/dashboard')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance del Día
            </CardTitle>
            <DollarSign className="w-5 h-5 text-blue-600 !mt-0" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-bold ${(stats.total_vendido_hoy - stats.total_egresos_hoy) >= 0 ? 'text-green-600' : 'text-destructive'} break-words overflow-wrap-anywhere pb-8`}>
              {formatCurrency(stats.total_vendido_hoy - stats.total_egresos_hoy, showCents)}
            </div>
          </CardContent>
          <div className="absolute bottom-3 right-3 bg-green-100 rounded-full p-2 hover:bg-green-200 transition-colors duration-200">
            <ArrowRight className="w-4 h-4 text-green-600" />
          </div>
        </Card>

        <Card 
          data-testid="card-cantidad-ventas"
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative"
          onClick={() => navigate('/ventas?filter=today')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ventas Realizadas Hoy
            </CardTitle>
            <ShoppingCart className="w-5 h-5 text-primary !mt-0" />
          </CardHeader>
          <CardContent>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground leading-none">
              Saldo Cta. Cte.
            </CardTitle>
            <Users className="w-5 h-5 text-orange-600 flex-shrink-0 !mt-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-orange-600 break-words overflow-wrap-anywhere pb-8">
              {formatCurrency(stats.total_saldo_cuenta_corriente, showCents)}
            </div>
          </CardContent>
          <div className="absolute bottom-3 right-3 bg-orange-100 rounded-full p-2 hover:bg-orange-200 transition-colors duration-200">
            <ArrowRight className="w-4 h-4 text-orange-600" />
          </div>
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
                      {formatCurrency(total, showCents)}
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
