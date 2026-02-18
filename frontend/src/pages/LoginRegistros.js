import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Clock, User, Monitor, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';

const LoginRegistros = () => {
  const { getAuthHeader } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRegistros = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/login-registros`, {
        headers: getAuthHeader(),
      });
      setRegistros(response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('No tienes permisos para ver los registros de login');
      } else {
        toast.error('Error al cargar los registros de login');
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchRegistros();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRegistros]);

  if (loading) {
    return <div className="text-center py-8">Cargando registros de login...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Registros de Login</h1>
        <p className="text-muted-foreground">
          Historial de accesos de usuarios al sistema
        </p>
      </div>

      <ResponsiveTable
        headers={[
          { title: 'Usuario', width: '25%' },
          { title: 'Fecha', width: '20%' },
          { title: 'Hora', width: '15%' },
          { title: 'IP Address', width: '20%' },
          { title: 'Dispositivo', width: '20%' }
        ]}
        rows={registros}
        renderDesktopRow={(registro, index) => (
          <tr key={registro.id} className="border-b hover:bg-muted/50 transition-colors">
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <LogIn className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{registro.usuario_nombre}</div>
                </div>
              </div>
            </td>
            <td className="p-4 text-sm text-muted-foreground">
              {format(new Date(registro.fecha), 'PPP', { locale: es })}
            </td>
            <td className="p-4 text-sm text-muted-foreground">
              {format(new Date(registro.fecha), 'HH:mm:ss', { locale: es })}
            </td>
            <td className="p-4 text-sm font-mono text-muted-foreground">
              {registro.ip_address || 'No disponible'}
            </td>
            <td className="p-4 text-sm text-muted-foreground">
              {registro.user_agent ? (
                <div className="max-w-xs truncate">
                  {extractDeviceInfo(registro.user_agent)}
                </div>
              ) : (
                'No disponible'
              )}
            </td>
          </tr>
        )}
        renderMobileCard={(registro, index) => (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <LogIn className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{registro.usuario_nombre}</h3>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(registro.fecha), 'PPP HH:mm:ss', { locale: es })}
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              {registro.ip_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Monitor className="w-4 h-4" />
                  <span className="font-mono">{registro.ip_address}</span>
                </div>
              )}
              {registro.user_agent && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <div className="truncate">{extractDeviceInfo(registro.user_agent)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      />

      {registros.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <LogIn className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
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
