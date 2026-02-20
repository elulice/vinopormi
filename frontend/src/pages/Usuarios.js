import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import ResponsiveTable from '@/components/ResponsiveTable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { API } from '@/lib/config';

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
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los usuarios y accesos al sistema
          </p>
        </div>
      </div>

      {/* BUSCADOR + BOTÓN AGREGAR */}
      <div className="flex gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 pr-7 h-7 text-sm w-40"
          />
          {searchTerm && (
            <X 
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setSearchTerm('')}
            />
          )}
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Nuevo
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  required
                  placeholder="Ej: Juan Pérez"
                  className="h-8"
                />
              </div>

              <div>
                <Label className="text-xs">Usuario</Label>
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
                  className="h-8"
                />
              </div>

              <div>
                <Label className="text-xs">
                  {editingUsuario ? 'Contraseña (opcional)' : 'Contraseña'}
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
                  placeholder={editingUsuario ? "Nueva contraseña" : "Contraseña"}
                  className="h-8"
                />
              </div>

              <div>
                <Label className="text-xs">Rol</Label>
                <Select
                  value={formData.rol}
                  onValueChange={(value) => setFormData({ ...formData, rol: value })}
                  disabled={editingUsuario && user?.id === editingUsuario.id}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comun">Usuario Común</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                {editingUsuario && user?.id === editingUsuario.id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No puedes modificar tu propio rol
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 h-8">
                  {editingUsuario ? 'Actualizar' : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="h-8"
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
          { title: 'Fecha', width: '15%' },
          { title: 'Acciones', width: '20%' }
        ]}
        rows={filteredUsuarios}
        renderDesktopRow={(usuario, index) => (
          <tr key={usuario.id} className="border-b">
            <td className="p-2">
              <div className="flex items-center gap-2 text-sm">
                {user?.id === usuario.id ? (
                  <Shield className="w-3 h-3 text-primary" />
                ) : (
                  <User className="w-3 h-3 text-secondary" />
                )}
                <span>{usuario.username}</span>
                {user?.id === usuario.id && (
                  <span className="text-xs text-primary">(tú)</span>
                )}
              </div>
            </td>
            <td className="p-2 text-sm">{usuario.nombre}</td>
            <td className="p-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                usuario.rol === 'admin' 
                  ? 'bg-red-100 text-red-800 border border-red-200' 
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {usuario.rol === 'admin' ? 'Admin' : 'Usuario'}
              </span>
            </td>
            <td className="p-2 text-muted-foreground text-xs">
              {format(new Date(usuario.timestamp), 'dd/MM/yyyy')}
            </td>
            <td className="p-2 text-right">
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-1"
                  onClick={() => handleEdit(usuario)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-1 text-destructive"
                  onClick={() => handleDelete(usuario.id)}
                  disabled={user?.id === usuario.id}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(usuario, index) => (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-secondary/10 rounded flex items-center justify-center">
                {user?.id === usuario.id ? (
                  <Shield className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-secondary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm">{usuario.username}</h3>
                <div className="text-xs text-muted-foreground">{usuario.nombre}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                usuario.rol === 'admin' 
                  ? 'bg-red-100 text-red-800 border border-red-200' 
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {usuario.rol === 'admin' ? 'Admin' : 'Usuario'}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(usuario.timestamp), 'dd/MM/yyyy')}
              </span>
            </div>
            
            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(usuario)}
                className="flex-1 h-7 text-xs"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive flex-1 h-7 text-xs"
                onClick={() => handleDelete(usuario.id)}
                disabled={user?.id === usuario.id}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />

      {/* ESTADO VACÍO */}
      {filteredUsuarios.length === 0 && (
        <Card className="py-6">
          <CardContent className="py-6 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
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
