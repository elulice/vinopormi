import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Plus, Pencil, Trash2, Package, Search, Info } from 'lucide-react';
import { toast } from 'sonner';
import ResponsiveTable from '@/components/ResponsiveTable';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { useDebounce } from '@/hooks/useDebounce';
import Pagination from '@/components/Pagination';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Productos = () => {
  const { getAuthHeader } = useAuth();

  const [productos, setProductos] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
    has_next: false,
    has_prev: false
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingPage, setLoadingPage] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // Aplicar debouncing al término de búsqueda (300ms)
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [formData, setFormData] = useState({
    nombre: '',
    precio_unitario: '',
    stock: '',
    // Descuento por cantidad (opcional)
    descuento_cantidad_minima: '',
    descuento_precio_unitario: '',
  });

  /* =============================
     FETCH
  ============================== */
  const fetchProductos = useCallback(async (page = 1, search = null) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingPage(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (search) {
        params.append('search', search);
      }

      const res = await axios.get(`${API}/productos-paginados?${params}`, {
        headers: getAuthHeader(),
      });
      
      setProductos(res.data.productos);
      setPagination(res.data.pagination);
    } catch (error) {
      toast.error('Error al cargar productos');
      console.error('Error fetching productos:', error);
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
  }, [getAuthHeader, pagination.limit]);

  useEffect(() => {
    fetchProductos(1);
  }, [fetchProductos]);

  // Fetch cuando cambia la búsqueda (solo si no está activo el search)
  useEffect(() => {
    if (!isSearchActive) {
      fetchProductos(1, debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, isSearchActive, fetchProductos]);

  /* =============================
     FORM
  ============================== */
  const resetForm = useCallback(() => {
    setFormData({ 
      nombre: '', 
      precio_unitario: '', 
      stock: '',
      descuento_cantidad_minima: '',
      descuento_precio_unitario: '',
    });
    setEditingProducto(null);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const payload = {
      nombre: formData.nombre,
      precio_unitario: Number(formData.precio_unitario),
      stock: formData.stock ? Number(formData.stock) : 0,
      // Descuento por cantidad (opcional - solo si ambos valores están completos)
      ...(formData.descuento_cantidad_minima && formData.descuento_precio_unitario ? {
        descuento_cantidad_minima: Number(formData.descuento_cantidad_minima),
        descuento_precio_unitario: Number(formData.descuento_precio_unitario)
      } : {}),
    };

    try {
      if (editingProducto) {
        await axios.put(`${API}/productos/${editingProducto.id}`, payload, {
          headers: getAuthHeader(),
        });
        toast.success('Producto actualizado');
      } else {
        await axios.post(`${API}/productos`, payload, {
          headers: getAuthHeader(),
        });
        toast.success('Producto creado');
      }

      setDialogOpen(false);
      resetForm();
      fetchProductos(1);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar producto');
    }
  }, [formData, editingProducto, getAuthHeader]);

  const handleEdit = useCallback((producto) => {
    setEditingProducto(producto);
    setFormData({
      nombre: producto.nombre,
      precio_unitario: String(producto.precio_unitario),
      stock: producto.stock ? String(producto.stock) : '',
      descuento_cantidad_minima: producto.descuento_cantidad_minima ? String(producto.descuento_cantidad_minima) : '',
      descuento_precio_unitario: producto.descuento_precio_unitario ? String(producto.descuento_precio_unitario) : '',
    });
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar producto?')) return;

    try {
      await axios.delete(`${API}/productos/${id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Producto eliminado');
      fetchProductos(pagination.page);
    } catch {
      toast.error('Error al eliminar producto');
    }
  }, [getAuthHeader]);

  // Manejador de cambio de página
  const handlePageChange = useCallback((newPage) => {
    fetchProductos(newPage, debouncedSearchTerm);
    setPagination(prev => ({ ...prev, page: newPage }));
  }, [fetchProductos, debouncedSearchTerm]);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Productos</h1>
        <p className="text-muted-foreground">
          Gestiona el inventario de tu vinoteca
        </p>
      </div>

      {/* BUSCADOR + MODAL */}
      <div className="flex gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
              <DialogDescription>
                Completa los datos del producto
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
                />
              </div>

              <div>
                <Label>Precio Unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.precio_unitario}
                  onChange={(e) =>
                    setFormData({ ...formData, precio_unitario: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label>Stock (opcional)</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                />
              </div>

              {/* Descuento por Cantidad (Opcional) */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">
                  <Info className="w-4 h-4 mr-2 inline" />
                  Descuento por Cantidad (Opcional)
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Cantidad Mínima</Label>
                    <Input
                      type="number"
                      min="2"
                      value={formData.descuento_cantidad_minima}
                      onChange={(e) =>
                        setFormData({ ...formData, descuento_cantidad_minima: e.target.value })
                      }
                      placeholder="Ej: 6"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Precio con Descuento</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.descuento_precio_unitario}
                      onChange={(e) =>
                        setFormData({ ...formData, descuento_precio_unitario: e.target.value })
                      }
                      placeholder="Ej: 150"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Si se vende {formData.descuento_cantidad_minima || 'X'} o más unidades, se aplicará el precio de ${formData.descuento_precio_unitario || 'X'} por unidad
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingProducto ? 'Actualizar' : 'Crear'}
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

      {/* TABLA */}
      <ResponsiveTable
        headers={[
          { title: 'Nombre', width: '30%' },
          { title: 'Stock', width: '15%' },
          { title: 'Precio', width: '15%' },
          { title: 'Descuento', width: '20%' },
          { title: 'Acciones', width: '20%' }
        ]}
        rows={productos}
        renderDesktopRow={(p, index) => (
          <tr key={p.id} className="border-b">
            <td className="p-4 flex gap-2 items-center">
              <Package className="w-4 h-4 text-primary" />
              {p.nombre}
            </td>
            <td className="p-4">
              {Number(p.stock) || 0} unidades
            </td>
            <td className="p-4 font-semibold text-primary">
              {formatCurrency(p.precio_unitario)}
            </td>
            <td className="p-4">
              {p.descuento_cantidad_minima && p.descuento_precio_unitario ? (
                <div className="text-xs">
                  <div className="text-green-600 font-medium">
                    ≥{p.descuento_cantidad_minima} u.
                  </div>
                  <div>{formatCurrency(p.descuento_precio_unitario)} c/u</div>
                </div>
              ) : (
                <span className="text-gray-400 text-xs">Sin descuento</span>
              )}
            </td>
            <td className="p-4">
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(p)}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => handleDelete(p.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(p, index) => (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{p.nombre}</h3>
                <div className="text-lg font-bold text-primary">
                  {formatCurrency(p.precio_unitario)}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Stock: </span>
                <span className="font-medium">{Number(p.stock) || 0} unidades</span>
              </div>
              {p.descuento_cantidad_minima && p.descuento_precio_unitario ? (
                <div className="text-sm">
                  <div className="text-green-600 font-medium">
                    Descuento ≥{p.descuento_cantidad_minima}u
                  </div>
                  <div className="text-green-600">
                    {formatCurrency(p.descuento_precio_unitario)} c/u
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Sin descuento
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-3 border-t">
              <Button size="sm" variant="outline" onClick={() => handleEdit(p)} className="flex-1">
                <Pencil className="w-4 h-4 mr-1" /> Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive flex-1"
                onClick={() => handleDelete(p.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
            </div>
          </div>
        )}
      />
      
      {/* Componente de Paginación */}
      {!loading && (
        <Card>
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
      
      {/* Loading Overlay para cambios de página */}
      {loadingPage && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Productos;
