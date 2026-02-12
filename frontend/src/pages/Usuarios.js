import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  Shield,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import ResponsiveTable from '@/components/ResponsiveTable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Usuarios = () => {
  const { getAuthHeader, user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    nombre: '',
    password: '',
    rol: 'comun'
  });

  const fetchUsuarios = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/usuarios`, {
        headers: getAuthHeader(),
      });
      setUsuarios(response.data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchUsuarios();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUsuarios]);

  const resetForm = () => {
    setFormData({ username: '', nombre: '', password: '', rol: 'comun' });
    setEditingUsuario(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      username: formData.username,
      nombre: formData.nombre,
      rol: formData.rol,
    };

    // Solo incluir password si se proporciona (al crear o al editar con nueva contraseña)
    if (formData.password) {
      data.password = formData.password;
    }

    try {
      if (editingUsuario) {
        await axios.put(`${API}/admin/usuarios/${editingUsuario.id}`, data, {
          headers: getAuthHeader(),
        });
        toast.success('Usuario actualizado');
      } else {
        // Al crear, password es requerido
        if (!formData.password) {
          toast.error('La contraseña es requerida para crear un usuario');
          return;
        }
        await axios.post(`${API}/admin/usuarios`, data, {
          headers: getAuthHeader(),
        });
        toast.success('Usuario creado');
      }

      setDialogOpen(false);
      resetForm();
      fetchUsuarios();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar usuario');
    }
  };

  const handleEdit = (usuario) => {
    setEditingUsuario(usuario);
    setFormData({
      username: usuario.username,
      nombre: usuario.nombre,
      rol: usuario.rol,
      password: '' // Dejar en blanco para que no se requiera al editar
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    // Evitar eliminar el usuario actual
    if (user?.id === id) {
      toast.error('No puedes eliminar tu propio usuario');
      return;
    }

    if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
      await axios.delete(`${API}/admin/usuarios/${id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Usuario eliminado');
      fetchUsuarios();
    } catch {
      toast.error('Error al eliminar usuario');
    }
  };

  const filteredUsuarios = usuarios.filter((u) =>
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Usuarios</h1>
          <p className="text-muted-foreground">
            Gestiona los usuarios y accesos al sistema
          </p>
        </div>
      </div>

      {/* BUSCADOR + BOTÓN AGREGAR */}
      <div className="flex gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}
              </DialogTitle>
              <DialogDescription>
                {editingUsuario
                  ? 'Modifica los datos del usuario seleccionado'
                  : 'Crea un nuevo usuario para acceder al sistema'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  required
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <Label>Nombre de Usuario</Label>
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      username: e.target.value,
                    })
                  }
                  required
                  placeholder="Ej: jperez"
                />
              </div>

              <div>
                <Label>
                  {editingUsuario ? 'Contraseña (dejar en blanco para mantener actual)' : 'Contraseña'}
                </Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value,
                    })
                  }
                  required={!editingUsuario}
                  placeholder={editingUsuario ? "Nueva contraseña (opcional)" : "Contraseña"}
                />
              </div>

              <div>
                <Label>Rol</Label>
                <select
                  value={formData.rol}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rol: e.target.value,
                    })
                  }
                  required
                  className="w-full p-2 border rounded-md"
                  disabled={editingUsuario && user?.id === editingUsuario.id}
                >
                  <option value="comun">Usuario Común</option>
                  <option value="admin">Administrador</option>
                </select>
                {editingUsuario && user?.id === editingUsuario.id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No puedes modificar tu propio rol
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingUsuario ? 'Actualizar' : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABLA RESPONSIVA */}
      <ResponsiveTable
        headers={[
          { title: 'Usuario', width: '25%' },
          { title: 'Nombre', width: '20%' },
          { title: 'Rol', width: '20%' },
          { title: 'Fecha Creación', width: '15%' },
          { title: 'Acciones', width: '20%' }
        ]}
        rows={filteredUsuarios}
        renderDesktopRow={(usuario, index) => (
          <tr key={usuario.id} className="border-b">
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                  {user?.id === usuario.id ? (
                    <Shield className="w-4 h-4 text-primary" />
                  ) : (
                    <User className="w-4 h-4 text-secondary" />
                  )}
                </div>
                <div>
                  <span className="font-medium">{usuario.username}</span>
                  {user?.id === usuario.id && (
                    <div className="text-xs text-primary">Tú</div>
                  )}
                </div>
              </div>
            </td>
            <td className="p-4 font-medium">{usuario.nombre}</td>
            <td className="p-4">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                usuario.rol === 'admin' 
                  ? 'bg-red-100 text-red-800 border border-red-200' 
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {usuario.rol === 'admin' ? '🛡️ Administrador' : '👤 Usuario Común'}
              </span>
            </td>
            <td className="p-4 text-muted-foreground">
              {format(new Date(usuario.timestamp), 'dd/MM/yyyy', { locale: es })}
            </td>
            <td className="p-4">
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(usuario)}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => handleDelete(usuario.id)}
                  disabled={user?.id === usuario.id}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(usuario, index) => (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                {user?.id === usuario.id ? (
                  <Shield className="w-5 h-5 text-primary" />
                ) : (
                  <User className="w-5 h-5 text-secondary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{usuario.username}</h3>
                <div className="text-sm text-muted-foreground">{usuario.nombre}</div>
                {user?.id === usuario.id && (
                  <div className="text-xs text-primary font-medium">Tú</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                usuario.rol === 'admin' 
                  ? 'bg-red-100 text-red-800 border border-red-200' 
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {usuario.rol === 'admin' ? '🛡️ Administrador' : '👤 Usuario Común'}
              </span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(usuario.timestamp), 'dd/MM/yyyy', { locale: es })}
              </span>
            </div>
            
            <div className="flex gap-2 pt-3 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(usuario)}
                className="flex-1"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive flex-1"
                onClick={() => handleDelete(usuario.id)}
                disabled={user?.id === usuario.id}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />

      {/* ESTADO VACÍO */}
      {filteredUsuarios.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm
                ? `No se encontraron usuarios con "${searchTerm}"`
                : 'No hay usuarios registrados aún. Crea uno para empezar.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Usuarios;
