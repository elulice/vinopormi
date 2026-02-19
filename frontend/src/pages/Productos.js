import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
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
import { Plus, Pencil, Trash2, Package, Info, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import ResponsiveTable from '@/components/ResponsiveTable';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { capitalizeWords } from '@/lib/utils';
import Pagination from '@/components/Pagination';
import { Loader2 } from 'lucide-react';
import { API } from '@/lib/config';

const Productos = () => {
  const { getAuthHeader } = useAuth();
  const { showCents } = useConfig();

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
  const searchInputRef = useRef(null);

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
  // Referencia estable para fetchProductos
  const fetchProductosRef = useRef();
  
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
  }, [pagination.limit, getAuthHeader]);

  // Mantener la referencia actualizada
  fetchProductosRef.current = fetchProductos;

useEffect(() => {
    fetchProductosRef.current?.(1);
  }, []);

  /* ==============================
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
      fetchProductosRef.current?.(pagination.page, searchTerm);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar producto');
    }
  }, [editingProducto, formData, pagination.page, resetForm, searchTerm, getAuthHeader]);

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
      fetchProductosRef.current?.(pagination.page, searchTerm);
    } catch {
      toast.error('Error al eliminar producto');
    }
  }, [pagination.page, searchTerm, getAuthHeader]);

  // Manejador de cambio de página
  const handlePageChange = useCallback((newPage) => {
    fetchProductosRef.current?.(newPage, searchTerm);
    setPagination(prev => ({ ...prev, page: newPage }));
    
    // Múltiples métodos para asegurar el scroll hacia arriba
    setTimeout(() => {
      // Método 1: Scroll instantáneo sin smooth behavior (más confiable)
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      // Método 2: Scroll al elemento principal
      const mainElement = document.querySelector('main') || document.querySelector('#root');
      if (mainElement) {
        mainElement.scrollTop = 0;
        mainElement.scrollTo(0, 0);
      }
      
      // Método 3: Forzar scroll con scrollIntoView
      const productosElement = document.querySelector('[class*="container"]') || document.querySelector('main');
      if (productosElement) {
        productosElement.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      
      // Método 4: Fallback agresivo
      window.scroll({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scroll({ top: 0, left: 0 });
    }, 200); // Mayor delay para asegurar que el contenido se renderizó
  }, [searchTerm]);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona el inventario de tu vinoteca
        </p>
      </div>

      {/* BUSCADOR + BOTÓN AGREGAR */}
      <div className="flex gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                fetchProductosRef.current?.(1, searchTerm);
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
            className="pl-7 pr-7 h-7 text-sm w-40"
          />
          {searchTerm && (
            <X 
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => {
                setSearchTerm('');
                fetchProductosRef.current?.(1, '');
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
            />
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
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

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                    className="h-8"
                  />
                </div>

                <div>
                  <Label className="text-xs">Precio Unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.precio_unitario}
                    onChange={(e) =>
                      setFormData({ ...formData, precio_unitario: e.target.value })
                    }
                    required
                    className="h-8"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Stock (opcional)</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  className="h-8"
                />
              </div>

              {/* Descuento por Cantidad (Opcional) */}
              <div className="border-t pt-3">
                <Label className="text-xs font-medium mb-2 block">
                  <Info className="w-3 h-3 mr-1 inline" />
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
                      className="h-7 text-xs"
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
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Si se vende {formData.descuento_cantidad_minima || 'X'} o más unidades, se aplicará el precio de ${formData.descuento_precio_unitario || 'X'} por unidad
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 h-8">
                  {editingProducto ? 'Actualizar' : 'Crear'}
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
            <td className="p-2">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-3 h-3 text-primary" />
                <span className="truncate">{capitalizeWords(p.nombre)}</span>
              </div>
            </td>
            <td className="p-2 text-muted-foreground text-xs">
              {Number(p.stock) || 0} unid.
            </td>
            <td className="p-2 font-semibold text-primary text-xs">
              {formatCurrency(p.precio_unitario, showCents)}
            </td>
            <td className="p-2">
              {p.descuento_cantidad_minima && p.descuento_precio_unitario ? (
                <div className="text-xs">
                  <div className="text-green-600 font-medium">
                    ≥{p.descuento_cantidad_minima} unid.
                  </div>
                  <div>{formatCurrency(p.descuento_precio_unitario, showCents)} c/u</div>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">-</span>
              )}
            </td>
            <td className="p-2 text-right">
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-1"
                  onClick={() => handleEdit(p)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-1 text-destructive"
                  onClick={() => handleDelete(p.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(p, index) => (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm truncate">{capitalizeWords(p.nombre)}</h3>
                <div className="font-bold text-primary text-sm">
                  {formatCurrency(p.precio_unitario, showCents)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Stock: {Number(p.stock) || 0} unid.</span>
              {p.descuento_cantidad_minima && p.descuento_precio_unitario ? (
                <span className="text-green-600 font-medium">
                  ≥{p.descuento_cantidad_minima} unid: {formatCurrency(p.descuento_precio_unitario, showCents)}
                </span>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Sin descuento
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => handleEdit(p)} className="flex-1 h-7 text-xs">
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive flex-1 h-7 text-xs"
                onClick={() => handleDelete(p.id)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />
      
      {/* Componente de Paginación */}
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
