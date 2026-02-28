import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Plus, Pencil, Trash2, Package, Info, X, Eye, EyeOff, Star } from 'lucide-react';
import { toast } from 'sonner';
import ResponsiveTable from '@/components/ResponsiveTable';
import MobileCard from '@/components/MobileCard';
import { formatCurrency } from '@/lib/currency';
import { capitalizeWords } from '@/lib/utils';
import Pagination from '@/components/Pagination';
import { Loader2 } from 'lucide-react';
import { API } from '@/lib/config';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import SearchInput from '@/components/common/SearchInput';
import StatusBadge from '@/components/common/StatusBadge';
import DeleteConfirmDialog from '@/components/common/DeleteConfirmDialog';

const Productos = () => {
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingProducto, setEditingProducto] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingPage, setLoadingPage] = useState(false);
  const [filters, setFilters] = useState({
    tipo: '',
    is_public: '',
    is_featured: '',
    has_discount: ''
  });
  const searchInputRef = useRef(null);

  const [formData, setFormData] = useState({
    nombre: '',
    precio_unitario: '',
    stock: '',
    tipo: 'normal',
    productos_incluidos: [],
    descuento_cantidad_minima: '',
    descuento_precio_unitario: '',
    is_public: false,
    is_featured: false,
    image_url: '',
  });
  const [productosNormales, setProductosNormales] = useState([]);
  const [showProductoSelect, setShowProductoSelect] = useState(false);
  const [productoSearch, setProductoSearch] = useState('');
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [localToggleUpdate, setLocalToggleUpdate] = useState({});

  /* =============================
     FETCH
  ============================== */
  // Referencia estable para fetchProductos
  const fetchProductosRef = useRef();
  
  const fetchProductos = useCallback(async (page = 1, search = null, currentFilters = null) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingPage(true);
      }

      const filtros = currentFilters || filters;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (search) {
        params.append('search', search);
      }
      
      if (filtros.tipo) {
        params.append('tipo', filtros.tipo);
      }
      if (filtros.is_public) {
        params.append('is_public', filtros.is_public);
      }
      if (filtros.is_featured) {
        params.append('is_featured', filtros.is_featured);
      }
      if (filtros.has_discount) {
        params.append('has_discount', filtros.has_discount);
      }

      const res = await apiGet(`${API}/productos-paginados?${params}`);
      
      const prodsConStock = await apiGet(`${API}/productos-stock`);
      const prodsMap = {};
      prodsConStock.data.forEach(p => { prodsMap[p.id] = p; });
      
      const productosConStockCalculado = res.data.productos.map(p => ({
        ...p,
        stock: prodsMap[p.id]?.stock ?? p.stock
      }));
      
      setProductos(productosConStockCalculado);
      setPagination(res.data.pagination);
    } catch (error) {
      toast.error('Error al cargar productos');
      console.error('Error fetching productos:', error);
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
  }, [pagination.limit, searchTerm, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantener la referencia actualizada
  fetchProductosRef.current = fetchProductos;

  useEffect(() => {
    fetchProductosRef.current?.(1);
  }, []);

  // Recargar cuando cambian los filtros
  useEffect(() => {
    fetchProductosRef.current?.(1, searchTerm, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (dialogOpen && formData.tipo === 'promo') {
      apiGet(`${API}/productos-stock`)
        .then(res => {
          const normals = res.data.filter(p => p.tipo !== 'promo');
          setProductosNormales(normals);
          setFilteredProductos(normals.slice(0, 50));
        });
    }
  }, [dialogOpen, formData.tipo]);

  const handleProductoSearch = useCallback((value) => {
    setProductoSearch(value);
    if (value && value.trim() !== '' && productosNormales.length > 0) {
      const terms = value.toLowerCase().trim().split(/\s+/);
      const filtered = productosNormales.filter(p => 
        terms.every(term => p.nombre.toLowerCase().includes(term))
      );
      setFilteredProductos(filtered);
    } else {
      setFilteredProductos(productosNormales.slice(0, 50));
    }
  }, [productosNormales]);

  const agregarProducto = useCallback((producto) => {
    const existente = formData.productos_incluidos.find(p => p.producto_id === producto.id);
    if (existente) {
      toast.error('El producto ya está incluido');
      return;
    }
    setFormData(prev => ({
      ...prev,
      productos_incluidos: [...prev.productos_incluidos, {
        producto_id: producto.id,
        cantidad: 1,
        nombre: producto.nombre,
        precio_unitario: producto.precio_unitario
      }]
    }));
    setShowProductoSelect(false);
    setProductoSearch('');
  }, [formData.productos_incluidos]);

  const eliminarProducto = useCallback((producto_id) => {
    setFormData(prev => ({
      ...prev,
      productos_incluidos: prev.productos_incluidos.filter(p => p.producto_id !== producto_id)
    }));
  }, []);

  const actualizarCantidad = useCallback((producto_id, cantidad) => {
    if (cantidad < 1) return;
    setFormData(prev => ({
      ...prev,
      productos_incluidos: prev.productos_incluidos.map(p => 
        p.producto_id === producto_id ? { ...p, cantidad: Number(cantidad) } : p
      )
    }));
  }, []);

  const totalProductos = useMemo(() => {
    return formData.productos_incluidos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0);
  }, [formData.productos_incluidos]);

  /* ==============================
     FORM
  ============================== */
  const resetForm = useCallback(() => {
    setFormData({ 
      nombre: '', 
      precio_unitario: '', 
      precio_costo: '',
      stock: '',
      tipo: 'normal',
      productos_incluidos: [],
      descuento_cantidad_minima: '',
      descuento_precio_unitario: '',
      is_public: false,
      is_featured: false,
      image_url: '',
    });
    setEditingProducto(null);
    setShowProductoSelect(false);
    setProductoSearch('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const payload = {
      nombre: formData.nombre,
      precio_unitario: Number(formData.precio_unitario),
      precio_costo: Number(formData.precio_costo) || 0,
      stock: formData.stock ? Number(formData.stock) : 0,
      tipo: formData.tipo,
      is_public: formData.is_public,
      is_featured: formData.is_featured,
      image_url: formData.image_url || null,
      ...(formData.tipo === 'promo' && formData.productos_incluidos.length > 0 ? {
        productos_incluidos: formData.productos_incluidos
      } : {}),
      ...(formData.descuento_cantidad_minima && formData.descuento_precio_unitario ? {
        descuento_cantidad_minima: Number(formData.descuento_cantidad_minima),
        descuento_precio_unitario: Number(formData.descuento_precio_unitario)
      } : {}),
    };

    try {
      if (editingProducto) {
        await apiPut(`${API}/productos/${editingProducto.id}`, payload);
        toast.success('Producto actualizado');
      } else {
        await apiPost(`${API}/productos`, payload);
        toast.success('Producto creado');
      }

      setDialogOpen(false);
      resetForm();
      fetchProductosRef.current?.(pagination.page, searchTerm, filters);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar producto');
    }
  }, [editingProducto, formData, pagination.page, resetForm, searchTerm, filters]);

  const handleEdit = useCallback(async (producto) => {
    setEditingProducto(producto);
    let productosInc = producto.productos_incluidos || [];
    
    if (producto.tipo === 'promo' && productosInc.length > 0) {
      const prods = await apiGet(`${API}/productos-stock`);
      const prodsMap = {};
      prods.data.forEach(p => { prodsMap[p.id] = p; });
      productosInc = productosInc.map(inc => ({
        ...inc,
        nombre: prodsMap[inc.producto_id]?.nombre || 'Unknown',
        precio_unitario: prodsMap[inc.producto_id]?.precio_unitario || 0
      }));
    }
    
    setFormData({
      nombre: producto.nombre,
      precio_unitario: String(producto.precio_unitario),
      precio_costo: producto.precio_costo ? String(producto.precio_costo) : '',
      stock: producto.stock ? String(producto.stock) : '',
      tipo: producto.tipo || 'normal',
      productos_incluidos: productosInc,
      descuento_cantidad_minima: producto.descuento_cantidad_minima ? String(producto.descuento_cantidad_minima) : '',
      descuento_precio_unitario: producto.descuento_precio_unitario ? String(producto.descuento_precio_unitario) : '',
      is_public: producto.is_public || false,
      is_featured: producto.is_featured || false,
      image_url: producto.image_url || '',
    });
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deletingId) return;

    try {
      await apiDelete(`${API}/productos/${deletingId}`);
      toast.success('Producto eliminado');
      fetchProductosRef.current?.(pagination.page, searchTerm, filters);
    } catch {
      toast.error('Error al eliminar producto');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  }, [deletingId, pagination.page, searchTerm, filters]);

  const togglePublic = useCallback(async (producto) => {
    const currentValue = localToggleUpdate[producto.id]?.is_public ?? producto.is_public;
    const newValue = !currentValue;
    // Actualizar estado local inmediatamente
    setLocalToggleUpdate(prev => ({
      ...prev,
      [producto.id]: { ...prev[producto.id], is_public: newValue }
    }));
    
    try {
      await apiPut(`${API}/productos/${producto.id}`, {
        is_public: newValue
      });
      toast.success(newValue ? 'Producto publicado' : 'Producto ocultado');
    } catch (error) {
      // Revertir cambio si hay error
      setLocalToggleUpdate(prev => ({
        ...prev,
        [producto.id]: { ...prev[producto.id], is_public: producto.is_public }
      }));
      toast.error(error.response?.data?.detail || 'Error al actualizar visibilidad');
    }
  }, [localToggleUpdate]);

  const toggleFeatured = useCallback(async (producto) => {
    const currentValue = localToggleUpdate[producto.id]?.is_featured ?? producto.is_featured;
    const newValue = !currentValue;
    // Actualizar estado local inmediatamente
    setLocalToggleUpdate(prev => ({
      ...prev,
      [producto.id]: { ...prev[producto.id], is_featured: newValue }
    }));
    
    try {
      await apiPut(`${API}/productos/${producto.id}`, {
        is_featured: newValue
      });
      toast.success(newValue ? 'Producto marcado como destacado' : 'Producto quitado de destacados');
    } catch (error) {
      // Revertir cambio si hay error
      setLocalToggleUpdate(prev => ({
        ...prev,
        [producto.id]: { ...prev[producto.id], is_featured: producto.is_featured }
      }));
      toast.error(error.response?.data?.detail || 'Error al actualizar destacado');
    }
  }, [localToggleUpdate]);

  // Función helper para obtener el valor del toggle (local o del producto)
  const getToggleValue = (producto, field) => {
    return localToggleUpdate[producto.id]?.[field] ?? producto[field];
  };

  // Manejador de cambio de página
  const handlePageChange = useCallback((newPage) => {
    fetchProductosRef.current?.(newPage, searchTerm, filters);
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
  }, [searchTerm, filters]);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-3">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona el inventario de tu vinoteca
        </p>
      </div>

      {/* BUSCADOR + BOTÓN AGREGAR */}
      <div className="flex gap-2 items-center flex-wrap">
        <SearchInput
          ref={searchInputRef}
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          onClear={() => {
            setSearchTerm('');
            fetchProductosRef.current?.(1, '');
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
          onSearch={() => {
            fetchProductosRef.current?.(1, searchTerm);
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }}
        />

        {/* Filtros como toggles */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilters({ ...filters, tipo: filters.tipo === 'normal' ? '' : 'normal' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.tipo === 'normal' 
                ? 'bg-primary text-white border-primary' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setFilters({ ...filters, tipo: filters.tipo === 'promo' ? '' : 'promo' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.tipo === 'promo' 
                ? 'bg-orange-500 text-white border-orange-500' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Promo
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setFilters({ ...filters, is_public: filters.is_public === 'true' ? '' : 'true' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.is_public === 'true' 
                ? 'bg-green-600 text-white border-green-600' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Público
          </button>
          <button
            onClick={() => setFilters({ ...filters, is_public: filters.is_public === 'false' ? '' : 'false' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.is_public === 'false' 
                ? 'bg-gray-500 text-white border-gray-500' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Oculto
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setFilters({ ...filters, is_featured: filters.is_featured === 'true' ? '' : 'true' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.is_featured === 'true' 
                ? 'bg-yellow-500 text-white border-yellow-500' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            ★ Destacado
          </button>
          <button
            onClick={() => setFilters({ ...filters, is_featured: filters.is_featured === 'false' ? '' : 'false' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.is_featured === 'false' 
                ? 'bg-gray-400 text-white border-gray-400' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Normal
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setFilters({ ...filters, has_discount: filters.has_discount === 'true' ? '' : 'true' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.has_discount === 'true' 
                ? 'bg-green-600 text-white border-green-600' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Con Desc
          </button>
          <button
            onClick={() => setFilters({ ...filters, has_discount: filters.has_discount === 'false' ? '' : 'false' })}
            className={`px-2 py-1 text-xs rounded border ${
              filters.has_discount === 'false' 
                ? 'bg-gray-400 text-white border-gray-400' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Sin Desc
          </button>
        </div>

        {(filters.tipo || filters.is_public || filters.is_featured || filters.has_discount) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setFilters({ tipo: '', is_public: '', is_featured: '', has_discount: '' })}
          >
            Limpiar
          </Button>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) {
            resetForm();
          }
          setDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Nuevo Producto
            </Button>
          </DialogTrigger>

          <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                  <Label className="text-xs">Tipo</Label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value, productos_incluidos: e.target.value === 'normal' ? [] : formData.productos_incluidos })}
                    className="flex h-7 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="normal">Normal</option>
                    <option value="promo">Promo</option>
                  </select>
                </div>
              </div>

              {formData.tipo === 'promo' && (
                <div className="border rounded-md p-3 space-y-2">
                  <Label className="text-xs font-medium">Productos incluidos</Label>
                  
                  {formData.productos_incluidos.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {formData.productos_incluidos.map((p, idx) => (
                        <div key={p.producto_id} className="flex items-center gap-2 text-xs bg-muted p-2 rounded">
                          <span className="flex-1 truncate">{p.nombre}</span>
                          <Input
                            type="number"
                            min="1"
                            value={p.cantidad}
                            onChange={(e) => actualizarCantidad(p.producto_id, e.target.value)}
                            className="w-16 h-6"
                          />
                          <span className="w-20 text-right">{formatCurrency(p.precio_unitario * p.cantidad, showCents)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => eliminarProducto(p.producto_id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-medium border-t pt-2">
                        <span>Total productos:</span>
                        <span>{formatCurrency(totalProductos, showCents)}</span>
                      </div>
                    </div>
                  )}

                  {showProductoSelect ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          placeholder="Buscar producto... (Enter para buscar)"
                          value={productoSearch}
                          onChange={(e) => setProductoSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleProductoSearch(productoSearch);
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="h-7 text-xs pr-7"
                          autoFocus
                        />
                        {productoSearch && (
                          <X
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => {
                              setProductoSearch('');
                              setFilteredProductos(productosNormales.slice(0, 50));
                            }}
                          />
                        )}
                      </div>
                      <div className="max-h-32 overflow-y-auto border rounded">
                        {filteredProductos.map(p => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer text-xs"
                            onClick={() => agregarProducto(p)}
                          >
                            <span>{p.nombre}</span>
                            <span className="text-muted-foreground">{formatCurrency(p.precio_unitario, showCents)}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-6 text-xs"
                        onClick={() => { setShowProductoSelect(false); setProductoSearch(''); setFilteredProductos(productosNormales.slice(0, 50)); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => { 
                        setShowProductoSelect(true); 
                        setProductoSearch('');
                        setFilteredProductos(productosNormales.slice(0, 50));
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar producto
                    </Button>
                  )}
                </div>
              )}

                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                    className="h-7"
                    placeholder={formData.tipo === 'promo' ? 'Ej: Combo Verano' : ''}
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
                    className="h-7"
                  />
                </div>

                <div>
                  <Label className="text-xs">Precio de Costo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.precio_costo}
                    onChange={(e) =>
                      setFormData({ ...formData, precio_costo: e.target.value })
                    }
                    className="h-7"
                    placeholder="0.00"
                  />
                </div>

              {formData.tipo === 'normal' && (
                <div>
                  <Label className="text-xs">Stock (opcional)</Label>
                  <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: e.target.value })
                    }
                    className="h-7"
                  />
                </div>
              )}

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

              {/* Visibilidad Pública */}
              <div className="border-t pt-3 space-y-3">
                <Label className="text-xs font-medium block">Visibilidad</Label>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="is_public" className="text-xs cursor-pointer">
                    Mostrar en Catálogo Público
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="is_featured" className="text-xs cursor-pointer">
                    Producto Destacado (Home)
                  </Label>
                </div>

                <div>
                  <Label className="text-xs">URL de Imagen</Label>
                  <Input
                    value={formData.image_url}
                    onChange={(e) =>
                      setFormData({ ...formData, image_url: e.target.value })
                    }
                    placeholder="https://..."
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 h-7">
                  {editingProducto ? 'Actualizar' : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="h-7"
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
          { title: 'Nombre', width: '20%' },
          { title: 'Tipo', width: '8%' },
          { title: 'Stock', width: '10%' },
          { title: 'Precio', width: '12%' },
          { title: 'Descuento', width: '15%' },
          { title: 'Visible', width: '15%' },
          { title: 'Acciones', width: '20%' }
        ]}
        rows={productos}
        renderDesktopRow={(p, index) => (
          <tr key={p.id} className="border-b">
            <td className="p-2">
              <div className="flex items-center gap-2 text-xs">
                <Package className={`w-3 h-3 ${p.tipo === 'promo' ? 'text-orange-500' : 'text-primary'}`} />
                <span className="truncate">{capitalizeWords(p.nombre)}</span>
              </div>
            </td>
            <td className="p-2 text-xs">
              <StatusBadge status={p.tipo === 'promo' ? "Promo" : "Normal"} />
            </td>
            <td className="p-2 text-muted-foreground text-xs">
              {Number(p.stock) || 0}
            </td>
            <td className="p-2 font-semibold text-primary text-xs">
              {formatCurrency(p.precio_unitario, showCents)}
            </td>
            <td className="p-2">
              {p.descuento_cantidad_minima && p.descuento_precio_unitario ? (
                <div className="text-xs">
                  <div className="text-green-600 font-medium">
                    ≥{p.descuento_cantidad_minima}
                  </div>
                  <div>{formatCurrency(p.descuento_precio_unitario, showCents)}</div>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">-</span>
              )}
            </td>
            <td className="p-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => togglePublic(p)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={getToggleValue(p, 'is_public') ? "Ocultar del público" : "Mostrar al público"}
                >
                  {getToggleValue(p, 'is_public') ? (
                    <Eye className="w-3 h-3 text-green-600" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-gray-300" />
                  )}
                </button>
                <button
                  onClick={() => toggleFeatured(p)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={getToggleValue(p, 'is_featured') ? "Quitar de destacados" : "Marcar como destacado"}
                >
                  {getToggleValue(p, 'is_featured') ? (
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <Star className="w-3 h-3 text-gray-300" />
                  )}
                </button>
              </div>
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
          <MobileCard>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${p.tipo === 'promo' ? 'bg-orange-100' : 'bg-primary/10'} rounded-lg flex items-center justify-center`}>
                  <Package className={`w-4 h-4 ${p.tipo === 'promo' ? 'text-orange-500' : 'text-primary'}`} />
                </div>
                <div>
                  <div className="font-semibold text-xs truncate">{capitalizeWords(p.nombre)}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock: {Number(p.stock) || 0}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-primary">
                  {formatCurrency(p.precio_unitario, showCents)}
                </div>
                {p.descuento_cantidad_minima && p.descuento_precio_unitario ? (
                  <div className="text-xs text-green-600">
                    ≥{p.descuento_cantidad_minima}: {formatCurrency(p.descuento_precio_unitario, showCents)}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Sin dto.</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {p.tipo === 'promo' ? (
                  <span className="text-orange-500">Promo</span>
                ) : (
                  <span>Normal</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {p.is_public ? (
                  <Eye className="w-3 h-3 text-green-600" />
                ) : (
                  <EyeOff className="w-3 h-3 text-gray-300" />
                )}
              </div>
            </div>
            
            <div className="flex gap-1 pt-2 border-t mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={(e) => { e.stopPropagation(); handleEdit(p); }} 
                className="flex-1 h-7 text-xs"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                className="text-destructive flex-1 h-7 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Eliminar
              </Button>
            </div>
          </MobileCard>
        )}
        useCard={false}
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

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Eliminar producto"
        description="¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer."
      />
    </div>
  );
};

export default Productos;
