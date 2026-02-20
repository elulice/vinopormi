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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { API } from '@/lib/config';

const Herramientas = () => {
  const { user, getAuthHeader } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [auditoriaDialogOpen, setAuditoriaDialogOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entidadesSeleccionadas, setEntidadesSeleccionadas] = useState([]);

  const entidadesOptions = [
    { id: 'producto', label: 'Productos' },
    { id: 'cliente', label: 'Cuentas Corrientes' },
    { id: 'egreso', label: 'Egresos' },
    { id: 'usuario', label: 'Usuarios' },
    { id: 'sticky_note', label: 'Sticky Notes' }
  ];

  const toggleEntidad = (id) => {
    setEntidadesSeleccionadas(prev => 
      prev.includes(id) 
        ? prev.filter(e => e !== id)
        : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (entidadesSeleccionadas.length === entidadesOptions.length) {
      setEntidadesSeleccionadas([]);
    } else {
      setEntidadesSeleccionadas(entidadesOptions.map(e => e.id));
    }
  };

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
    if (entidadesSeleccionadas.length === 0) {
      toast.error('Selecciona al menos un tipo de registro a eliminar');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post(`${BACKEND_URL}/limpiar-auditoria-direct`, 
        { entidades: entidadesSeleccionadas },
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
        }
      );
      
      toast.success(`${response.data.message} (${response.data.eliminados} registros)`);
      setAuditoriaDialogOpen(false);
      setEntidadesSeleccionadas([]);
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Acceso Restringido</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Solo administradores pueden acceder
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Herramientas</h1>
        <p className="text-sm text-muted-foreground">
          Mantenimiento del sistema
        </p>
      </div>

      <Card className="border-red-200 overflow-hidden">
        <CardHeader className="py-2 bg-red-50 border-b border-red-200">
          <CardTitle className="text-red-800 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" />
            Zona Crítica
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm mb-1">Limpiar Base de Datos</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Mantiene: Productos, Usuarios
              </p>
              <p className="text-xs text-red-600 mb-2">
                Elimina: Clientes, Ventas, Ctas Ctes, Egresos, Notificaciones
              </p>
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
                <Button variant="destructive" size="sm" disabled={loading}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  {loading ? "Eliminando..." : "Limpiar Base"}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-red-50 border-red-200 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-red-800 text-base">⚠️ Confirmación</DialogTitle>
                  <DialogDescription className="text-red-700 text-sm">
                    Se eliminarán: Clientes, Ventas, Ctas Ctes, Egresos, Notificaciones.
                    <br />
                    Solo se conservarán Productos y Usuarios.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLimpiarBaseDatos}
                    disabled={loading}
                    className="flex-1"
                  >
                    Sí, eliminar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
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
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trash2 className="w-4 h-4" />
            Limpieza de Registros
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Limpiar Auditoría */}
            <div className="space-y-2">
              <div>
                <h3 className="font-semibold text-sm mb-1">Limpiar Auditoría</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Elimina historial de cambios del sistema
                </p>
              </div>

              <Dialog 
                open={auditoriaDialogOpen} 
                onOpenChange={(open) => {
                  if (!open || !loading) {
                    setAuditoriaDialogOpen(open);
                    if (!open) setEntidadesSeleccionadas([]);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={loading}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    {loading ? "Eliminando..." : "Limpiar"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-base">Limpiar Auditoría</DialogTitle>
                    <DialogDescription className="text-sm">
                      Selecciona los registros a eliminar:
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-2 py-2">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox 
                        id="select-all"
                        checked={entidadesSeleccionadas.length === entidadesOptions.length && entidadesOptions.length > 0}
                        onCheckedChange={toggleTodos}
                      />
                      <Label htmlFor="select-all" className="text-xs font-medium">
                        Seleccionar todos
                      </Label>
                    </div>
                    {entidadesOptions.map((entidad) => (
                      <div key={entidad.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={entidad.id}
                          checked={entidadesSeleccionadas.includes(entidad.id)}
                          onCheckedChange={() => toggleEntidad(entidad.id)}
                        />
                        <Label htmlFor={entidad.id} className="text-xs">
                          {entidad.label}
                        </Label>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Selecciona al menos una opción.
                  </p>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleLimpiarAuditoria}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? "Eliminando..." : "Eliminar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAuditoriaDialogOpen(false);
                        setEntidadesSeleccionadas([]);
                      }}
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
            <div className="space-y-2">
              <div>
                <h3 className="font-semibold text-sm mb-1">Limpiar Login</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Elimina historial de accesos
                </p>
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
                  <Button variant="outline" size="sm" disabled={loading}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    {loading ? "Eliminando..." : "Limpiar"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-base">Limpiar Login</DialogTitle>
                    <DialogDescription className="text-sm">
                      Eliminar todos los registros de login del sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleLimpiarLoginRegistros}
                      disabled={loading}
                      className="flex-1"
                    >
                      Sí, eliminar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
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

      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="text-sm">Info del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Usuario:</span>
            <span className="font-medium">{user?.nombre} ({user?.rol})</span>
          </div>
          <div className="mt-2 p-2 bg-blue-50 rounded-md">
            <p className="text-xs text-blue-800">
              💡 Recomendación: Haz backup antes de operaciones críticas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Herramientas;