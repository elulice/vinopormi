import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Pagination from '@/components/Pagination';
import { LogIn, User, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';
import { apiGet } from '@/lib/api';

const LoginRegistros = () => {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    has_next: false,
    has_prev: false
  });

  const fetchRegistrosRef = useRef(null);

  const fetchRegistros = useCallback(async (page = 1) => {
    setLoadingPage(true);
    try {
      const response = await apiGet(`${API}/auth/login-registros?page=${page}&limit=50`);
      
      const data = response.data;
      setRegistros(data.data || data);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          pages: data.pagination.pages,
          has_next: data.pagination.page < data.pagination.pages,
          has_prev: data.pagination.page > 1
        });
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permisos para ver los registros de login');
      } else {
        toast.error('Error al cargar los registros de login');
      }
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
  }, []);

  fetchRegistrosRef.current = fetchRegistros;

  useEffect(() => {
    fetchRegistrosRef.current?.(1);
  }, []);

  const handlePageChange = (newPage) => {
    fetchRegistros(newPage);
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return <div className="text-center py-8">Cargando registros de login...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Registros de Login</h1>
        <p className="text-sm text-muted-foreground">
          Historial de accesos de usuarios al sistema
        </p>
      </div>

      <ResponsiveTable
        headers={[
          { title: 'Usuario', width: '25%' },
          { title: 'Fecha', width: '20%' },
          { title: 'IP', width: '20%' },
          { title: 'Dispositivo', width: '35%' }
        ]}
        rows={registros}
        renderDesktopRow={(registro, index) => (
          <tr key={registro.id} className="border-b">
            <td className="p-2">
              <div className="flex items-center gap-2 text-sm">
                <LogIn className="w-3 h-3 text-primary" />
                <span className="font-medium">{registro.usuario_nombre}</span>
              </div>
            </td>
            <td className="p-2 text-xs text-muted-foreground">
              {format(new Date(registro.fecha), 'dd/MM/yyyy HH:mm')}
            </td>
            <td className="p-2 text-xs font-mono text-muted-foreground">
              {registro.ip_address || '-'}
            </td>
            <td className="p-2 text-xs text-muted-foreground truncate max-w-xs">
              {registro.user_agent ? extractDeviceInfo(registro.user_agent) : '-'}
            </td>
          </tr>
        )}
        renderMobileCard={(registro, index) => (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                <LogIn className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm">{registro.usuario_nombre}</h3>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(registro.fecha), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Monitor className="w-3 h-3" />
              <span className="font-mono">{registro.ip_address || '-'}</span>
            </div>
            {registro.user_agent && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {extractDeviceInfo(registro.user_agent)}
              </div>
            )}
          </div>
        )}
      />

      {/* PAGINACIÓN */}
      {!loading && pagination.pages > 1 && (
        <Card className="py-2">
          <CardContent className="p-0">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
              hasNext={pagination.has_next}
              hasPrev={pagination.has_prev}
              loading={loadingPage}
            />
          </CardContent>
        </Card>
      )}

      {registros.length === 0 && !loading && (
        <Card className="py-6">
          <CardContent className="py-6 text-center">
            <LogIn className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay registros de login disponibles
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Función para extraer información básica del user agent
function extractDeviceInfo(userAgent) {
  const ua = userAgent.toLowerCase();
  
  // Detectar navegador
  let browser = 'Desconocido';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  
  // Detectar sistema operativo
  let os = 'Desconocido';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  return `${browser} en ${os}`;
}

export default LoginRegistros;
