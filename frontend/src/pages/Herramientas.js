import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertTriangle, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Herramientas = () => {
  const { user, getAuthHeader } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [auditoriaDialogOpen, setAuditoriaDialogOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLimpiarBaseDatos = async () => {
    setLoading(true);
    
    try {
      console.log("Iniciando limpieza de base de datos...");
      console.log("URL:", `${BACKEND_URL}/limpiar-base-datos-direct`);
      console.log("User:", user);
      
      // Usar endpoint directo - no va por /api
      const response = await axios.post(`${BACKEND_URL}/limpiar-base-datos-direct`, {}, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
      });
      
      console.log("Respuesta del servidor:", response.data);
      toast.success(response.data.message);
      
      // Mostrar detalles de lo eliminado
      const { eliminados } = response.data;
      let mensajeDetallado = "Datos eliminados:\n";
      for (const [coleccion, cantidad] of Object.entries(eliminados)) {
        mensajeDetallado += `- ${coleccion}: ${cantidad} registros\n`;
      }
      console.log(mensajeDetallado);
      
      setDialogOpen(false);
    } catch (error) {
      console.error("Error completo:", error);
      console.error("Error response:", error.response);
      console.error("Error message:", error.message);
      
      let errorMessage = "Error al limpiar base de datos";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiarAuditoria = async () => {
    setLoading(true);
    
    try {
      const response = await axios.post(`${BACKEND_URL}/limpiar-auditoria-direct`, {}, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
      });
      
      toast.success(`${response.data.message} (${response.data.eliminados} registros)`);
      setAuditoriaDialogOpen(false);
    } catch (error) {
      console.error("Error al limpiar auditoría:", error);
      
      let errorMessage = "Error al limpiar auditoría";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiarLoginRegistros = async () => {
    setLoading(true);
    
    try {
      const response = await axios.post(`${BACKEND_URL}/limpiar-login-registros-direct`, {}, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
      });
      
      toast.success(`${response.data.message} (${response.data.eliminados} registros)`);
      setLoginDialogOpen(false);
    } catch (error) {
      console.error("Error al limpiar registros de login:", error);
      
      let errorMessage = "Error al limpiar registros de login";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };



  // Solo permitir acceso a administradores
  if (user?.rol !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h1>
          <p className="text-gray-600 mb-6">
            Esta sección está disponible solo para administradores del sistema.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Herramientas de Administrador</h1>
        <p className="text-muted-foreground">
          Herramientas avanzadas para mantenimiento del sistema
        </p>
      </div>

      <Card className="border-red-200">
        <CardHeader className="bg-red-50 border-b border-red-200">
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Zona Crítica
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Limpiar Base de Datos</h3>
              <p className="text-gray-600 mb-4">
                Esta acción eliminará permanentemente todos los datos de la base de datos, 
                manteniendo solo:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
                <li>✅ Productos</li>
                <li>✅ Usuarios</li>
              </ul>
              <p className="text-red-600 font-semibold mt-2">
                Se eliminarán permanentemente:
              </p>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-1 ml-4">
                <li>🗑️ Clientes y toda su información</li>
                <li>🗑️ Ventas registradas</li>
                <li>🗑️ Movimientos de cuenta corriente</li>
                <li>🗑️ Egresos registrados</li>
                <li>🗑️ Notificaciones</li>
              </ul>
            </div>

            <Dialog 
              open={dialogOpen} 
              onOpenChange={(open) => {
                if (!open || !loading) {
                  setDialogOpen(open);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={loading}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {loading ? "Eliminando..." : "Limpiar Base de Datos"}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-red-50 border-red-200">
                <DialogHeader>
                  <DialogTitle className="text-red-800">⚠️ Confirmación Requerida</DialogTitle>
                  <DialogDescription className="text-red-700">
                    Esta acción es irreversible y eliminará permanentemente los datos de:
                    <br /><br />
                    <strong>Clientes, Ventas, Cuentas Corrientes, Egresos y Notificaciones</strong>
                    <br /><br />
                    Solo se conservarán Productos y Usuarios.
                    <br /><br />
                    <strong>¿Estás absolutamente seguro de continuar?</strong>
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="destructive"
                    onClick={handleLimpiarBaseDatos}
                    disabled={loading}
                    className="flex-1"
                  >
                    Sí, eliminar todo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN DE LIMPIEZA DE REGISTROS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Limpieza de Registros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Limpiar Auditoría */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Limpiar Auditoría</h3>
                <p className="text-gray-600 mb-4">
                  Esta acción eliminará permanentemente todos los registros de auditoría del sistema:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
                  <li>🗑️ Historial de cambios en productos</li>
                  <li>🗑️ Historial de cambios en clientes</li>
                  <li>🗑️ Historial de cambios en egresos</li>
                  <li>🗑️ Historial de cambios en usuarios</li>
                </ul>
              </div>

              <Dialog 
                open={auditoriaDialogOpen} 
                onOpenChange={(open) => {
                  if (!open || !loading) {
                    setAuditoriaDialogOpen(open);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={loading}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {loading ? "Eliminando..." : "Limpiar Auditoría"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>⚠️ Confirmación Requerida</DialogTitle>
                    <DialogDescription>
                      Esta acción eliminará permanentemente todos los registros de auditoría del sistema.
                      <br /><br />
                      <strong>¿Estás seguro de continuar?</strong>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="destructive"
                      onClick={handleLimpiarAuditoria}
                      disabled={loading}
                      className="flex-1"
                    >
                      Sí, eliminar auditoría
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAuditoriaDialogOpen(false)}
                      disabled={loading}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Limpiar Login Registros */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Limpiar Registros de Login</h3>
                <p className="text-gray-600 mb-4">
                  Esta acción eliminará permanentemente todos los registros de acceso de usuarios:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
                  <li>🗑️ Historial de accesos al sistema</li>
                  <li>🗑️ Direcciones IP registradas</li>
                  <li>🗑️ Información de dispositivos</li>
                  <li>🗑️ Fechas y horas de acceso</li>
                </ul>
              </div>

              <Dialog 
                open={loginDialogOpen} 
                onOpenChange={(open) => {
                  if (!open || !loading) {
                    setLoginDialogOpen(open);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={loading}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {loading ? "Eliminando..." : "Limpiar Registros de Login"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>⚠️ Confirmación Requerida</DialogTitle>
                    <DialogDescription>
                      Esta acción eliminará permanentemente todos los registros de login del sistema.
                      <br /><br />
                      <strong>¿Estás seguro de continuar?</strong>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="destructive"
                      onClick={handleLimpiarLoginRegistros}
                      disabled={loading}
                      className="flex-1"
                    >
                      Sí, eliminar login registros
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLoginDialogOpen(false)}
                      disabled={loading}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Usuario actual:</span> {user?.nombre} ({user?.rol})
            </div>
            <div>
              <span className="font-medium">Acceso:</span> Administrador
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-blue-800 text-sm">
              💡 <strong>Recomendación:</strong> Realiza una copia de seguridad completa 
              antes de ejecutar cualquier operación crítica.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Herramientas;