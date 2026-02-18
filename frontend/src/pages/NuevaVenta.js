import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ShoppingCart, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { capitalizeWords } from '@/lib/utils';
import { API } from '@/lib/config';
import { useDebounce } from '@/hooks/useDebounce';

const NuevaVenta = () => {
  const { getAuthHeader } = useAuth();
  const { showCents } = useConfig();
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);

  const [clientes, setClientes] = useState([]);
  const [medioPago, setMedioPago] = useState('efectivo');
  const [clienteId, setClienteId] = useState('');
  const [detalles, setDetalles] = useState([{
    producto_id: '',
    producto_nombre: '',
    cantidad: 1,
    precio_unitario: 0,
    subtotal: 0
  }]);
  const [loading, setLoading] = useState(false);
  const [productoSearchTerm, setProductoSearchTerm] = useState('');
  const [refreshingProductos, setRefreshingProductos] = useState(false);
  const [activeDetalleIndex, setActiveDetalleIndex] = useState(null);
  
  // Aplicar debouncing al término de búsqueda de productos (300ms)
  const debouncedProductoSearchTerm = useDebounce(productoSearchTerm, 300);
  const searchRefs = useRef([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const cantidadRefs = useRef([]);
  const resultRefs = useRef([]); // Para hacer scroll a los elementos de resultados

  // Set initial focus on first product search field after component loads
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchRefs.current[0] && productos.length > 0) {
        searchRefs.current[0].focus();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [productos]);

  const fetchProductos = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/productos-paginados?limit=1000`, {
        headers: getAuthHeader(),
      });
      setProductos(res.data.productos);
    } catch (error) {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const refreshProductos = async () => {
    setRefreshingProductos(true);
    try {
      const res = await axios.get(`${API}/productos-paginados?limit=1000`, {
        headers: getAuthHeader(),
      });
      setProductos(res.data.productos);
      toast.success('Lista de productos actualizada');
    } catch (error) {
      toast.error('Error al actualizar productos');
    } finally {
      setRefreshingProductos(false);
    }
  };

  const fetchClientes = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/clientes`, {
        headers: getAuthHeader()
      });
      setClientes(response.data);
    } catch (error) {
      toast.error('Error al cargar clientes');
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchProductos();
    fetchClientes();
  }, [fetchClientes, fetchProductos]);

  const handleKeyDown = (e, index) => {
    if (!activeDetalleIndex === index || !productoSearchTerm) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = selectedResultIndex < filteredProductos.length - 1 ? selectedResultIndex + 1 : selectedResultIndex;
        setSelectedResultIndex(nextIndex);
        
        // Hacer scroll al elemento seleccionado
        setTimeout(() => {
          const element = resultRefs.current[nextIndex];
          if (element) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest' 
            });
          }
        }, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = selectedResultIndex > 0 ? selectedResultIndex - 1 : 0;
        setSelectedResultIndex(prevIndex);
        
        // Hacer scroll al elemento seleccionado
        setTimeout(() => {
          const element = resultRefs.current[prevIndex];
          if (element) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest' 
            });
          }
        }, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredProductos[selectedResultIndex]) {
          actualizarDetalle(index, 'producto_id', filteredProductos[selectedResultIndex].id);
          setProductoSearchTerm('');
          setActiveDetalleIndex(null);
          setSelectedResultIndex(0);
          // Focus on quantity field after product selection
          setTimeout(() => {
            if (cantidadRefs.current[index]) {
              cantidadRefs.current[index].focus();
              cantidadRefs.current[index].select();
            }
          }, 100);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setProductoSearchTerm('');
        setActiveDetalleIndex(null);
        setSelectedResultIndex(0);
        resultRefs.current = []; // Limpiar referencias
        break;
    }
  };

  const agregarDetalle = () => {
    // Buscar si hay un item vacío (sin producto seleccionado)
    const emptyIndex = detalles.findIndex(detalle => !detalle.producto_id);
    
    if (emptyIndex !== -1) {
      // Si hay un item vacío, hacer focus en su campo de búsqueda
      setActiveDetalleIndex(emptyIndex);
      setSelectedResultIndex(0);
      setProductoSearchTerm('');
      setTimeout(() => {
        if (searchRefs.current[emptyIndex]) {
          searchRefs.current[emptyIndex].focus();
        }
      }, 100);
    } else {
      // Si no hay items vacíos, agregar uno nuevo
      const newDetalleIndex = detalles.length;
      const newDetalle = {
        producto_id: '',
        producto_nombre: '',
        cantidad: 1,
        precio_unitario: 0,
        subtotal: 0
      };
      setDetalles([...detalles, newDetalle]);
      setActiveDetalleIndex(newDetalleIndex);
      // Focus on search field after adding new row
      setTimeout(() => {
        if (searchRefs.current[newDetalleIndex]) {
          searchRefs.current[newDetalleIndex].focus();
        }
      }, 100);
    }
  };

  const eliminarDetalle = (index) => {
    const newDetalles = detalles.filter((_, i) => i !== index);
    
    // Si no quedan detalles, agregar uno vacío
    if (newDetalles.length === 0) {
      const newDetalle = {
        producto_id: '',
        producto_nombre: '',
        cantidad: 1,
        precio_unitario: 0,
        subtotal: 0
      };
      setDetalles([newDetalle]);
    } else {
      setDetalles(newDetalles);
    }
  };

  const resetForm = () => {
    const newDetalle = {
      producto_id: '',
      producto_nombre: '',
      cantidad:1,
      precio_unitario: 0,
      subtotal: 0
    };
    setDetalles([newDetalle]);
    setMedioPago('efectivo');
    setClienteId('');
    setProductoSearchTerm('');
    setActiveDetalleIndex(0); // Set focus on first product search field
    setSelectedResultIndex(0);
    // Auto-focus on first product search field
    setTimeout(() => {
      if (searchRefs.current[0]) {
        searchRefs.current[0].focus();
      }
    }, 100);
  };

  const actualizarDetalle = (index, field, value) => {
    const nuevosDetalles = [...detalles];
    
    if (field === 'producto_id') {
      // Validar que no se agregue un producto duplicado
      if (value && isProductoYaAgregado(value) && nuevosDetalles[index].producto_id !== value) {
        const producto = productos.find(p => p.id === value);
        toast.error(`El producto "${producto?.nombre}" ya está agregado. Elimina el registro actual si quieres cambiarlo.`);
        return;
      }
      
      const producto = productos.find(p => p.id === value);
      if (producto) {
        nuevosDetalles[index].producto_id = producto.id;
        nuevosDetalles[index].producto_nombre = producto.nombre;
        nuevosDetalles[index].precio_unitario = producto.precio_unitario;
        
        // Aplicar descuento por cantidad si corresponde
        let precioUnitario = producto.precio_unitario;
        if (producto.descuento_cantidad_minima && producto.descuento_precio_unitario) {
          if (nuevosDetalles[index].cantidad >= producto.descuento_cantidad_minima) {
            precioUnitario = producto.descuento_precio_unitario;
          }
        }
        
        nuevosDetalles[index].subtotal = precioUnitario * nuevosDetalles[index].cantidad;
      }
    } else if (field === 'cantidad') {
      const cantidad = parseInt(value) || 0;
      nuevosDetalles[index].cantidad = cantidad;
      
      // Aplicar descuento por cantidad si corresponde
      const producto = productos.find(p => p.id === nuevosDetalles[index].producto_id);
      let precioUnitario = nuevosDetalles[index].precio_unitario;
      
      if (producto && producto.descuento_cantidad_minima && producto.descuento_precio_unitario) {
        if (cantidad >= producto.descuento_cantidad_minima) {
          precioUnitario = producto.descuento_precio_unitario;
        }
      }
      
      nuevosDetalles[index].subtotal = precioUnitario * cantidad;
    }
    
    setDetalles(nuevosDetalles);
  };

  const calcularTotal = useCallback(() => {
    return detalles.reduce((sum, d) => sum + d.subtotal, 0);
  }, [detalles]);

  const isProductoYaAgregado = useCallback((productoId) => {
    return detalles.some(detalle => detalle.producto_id === productoId);
  }, [detalles]);

  const getProductosDisponibles = useCallback(() => {
    const productosAgregadosIds = detalles
      .filter(detalle => detalle.producto_id)
      .map(detalle => detalle.producto_id);
    
    return productos.filter(producto => !productosAgregadosIds.includes(producto.id));
  }, [detalles, productos]);

  // Memoizar productos filtrados para mejor rendimiento
  const filteredProductos = useMemo(() => {
    const productosDisponibles = getProductosDisponibles();
    if (!debouncedProductoSearchTerm) return productosDisponibles;
    
    const searchTermLower = debouncedProductoSearchTerm.toLowerCase();
    const searchTerms = searchTermLower.split(/\s+/).filter(term => term.length > 0);
    
    return productosDisponibles.filter(producto => {
      const productoNombreLower = producto.nombre.toLowerCase();
      
      // Si hay múltiples términos, todos deben estar presentes
      if (searchTerms.length > 1) {
        return searchTerms.every(term => productoNombreLower.includes(term));
      }
      
      // Búsqueda simple para un solo término
      return productoNombreLower.includes(searchTermLower);
    });
  }, [getProductosDisponibles, debouncedProductoSearchTerm]);

  useEffect(() => {
    setSelectedResultIndex(0);
    resultRefs.current = [];
  }, [debouncedProductoSearchTerm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out empty rows and check only valid products
    const productosValidos = detalles.filter(d => d.producto_id && d.cantidad > 0);
    
    if (productosValidos.length === 0) {
      toast.error('Agrega al menos un producto válido');
      return;
    }



    // Validación de medio de pago y cliente
    if (medioPago === 'cuenta_corriente' && !clienteId) {
      toast.error('Selecciona un cliente para cuenta corriente');
      return;
    }

    setLoading(true);

    try {
      const data = {
        medio_pago: medioPago,
        cliente_id: medioPago === 'cuenta_corriente' ? clienteId : null,
        detalles: productosValidos.map(d => {
          const producto = productos.find(p => p.id === d.producto_id);
          let precioUnitarioAplicado = d.precio_unitario;
          
          // Calcular precio unitario real con descuento si corresponde
          if (producto && producto.descuento_cantidad_minima && producto.descuento_precio_unitario) {
            if (d.cantidad >= producto.descuento_cantidad_minima) {
              precioUnitarioAplicado = producto.descuento_precio_unitario;
            }
          }
          
          return {
            producto_id: d.producto_id,
            producto_nombre: d.producto_nombre,
            cantidad: d.cantidad,
            precio_unitario: precioUnitarioAplicado,
            subtotal: d.subtotal
          };
        })
      };

      await axios.post(`${API}/ventas`, data, {
        headers: getAuthHeader()
      });
      
      toast.success('Venta registrada exitosamente');
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Venta</h1>
        <p className="text-sm text-muted-foreground">Registra una nueva venta</p>
      </div>

      <form className="space-y-4">
        <Card className="py-3">
          <CardHeader className="py-3 pb-2">
            <CardTitle className="text-base">Información de la Venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Medio de Pago</Label>
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    type="button"
                    variant={medioPago === 'cuenta_corriente' ? 'default' : 'outline'}
                    onClick={() => setMedioPago('cuenta_corriente')}
                    className="text-xs h-8"
                  >
                    Cta. Cte.
                  </Button>
                  <Button
                    type="button"
                    variant={medioPago === 'efectivo' ? 'default' : 'outline'}
                    onClick={() => setMedioPago('efectivo')}
                    className="text-xs h-8"
                  >
                    Efectivo
                  </Button>
                  <Button
                    type="button"
                    variant={medioPago === 'posnet' ? 'default' : 'outline'}
                    onClick={() => setMedioPago('posnet')}
                    className="text-xs h-8"
                  >
                    PosNet
                  </Button>
                  <Button
                    type="button"
                    variant={medioPago === 'transferencia' ? 'default' : 'outline'}
                    onClick={() => setMedioPago('transferencia')}
                    className="text-xs h-8"
                  >
                    Transf.
                  </Button>
                </div>
              </div>

              {medioPago === 'cuenta_corriente' && (
                <div className="space-y-2">
                  <Label htmlFor="cliente" className="text-xs">Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger id="cliente" data-testid="cliente-select" className="h-8">
                      <SelectValue placeholder="Selecciona un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(cliente => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="py-3">
          <CardHeader className="py-2 pb-1">
            <div className="flex justify-between items-center py-1">
              <CardTitle className="text-base">Productos</CardTitle>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  onClick={refreshProductos} 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={refreshingProductos}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${refreshingProductos ? 'animate-spin' : ''}`} />
                  {refreshingProductos ? 'Actualizando...' : 'Actualizar'}
                </Button>
                <Button type="button" onClick={agregarDetalle} size="sm" className="h-7 text-xs" data-testid="add-detalle-button">
                  <Plus className="w-3 h-3 mr-1" />
                  Agregar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            {detalles.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">
                No hay productos. Agrega uno para empezar.
              </p>
            ) : (
              <div>
                <div className="flex gap-2 items-end pb-2 mb-2 border-b">
                  <div className="flex-[2]">
                    <Label className="text-xs font-semibold">Producto</Label>
                  </div>
                  <div className="w-16">
                    <Label className="text-xs font-semibold">Cant.</Label>
                  </div>
                  <div className="w-24 text-right">
                    <Label className="text-xs font-semibold">Subtotal</Label>
                  </div>
                  <div className="w-8">
                  </div>
                </div>
                <div className="space-y-1">
                  {detalles.map((detalle, index) => (
                      <div key={index} className="flex gap-2 items-center p-2 bg-muted rounded-md" data-testid={`detalle-${index}`}>
                        <div className="flex-[2]">
                          <div className="relative">
                          {detalle.producto_id ? (
                             <div className="h-7 px-2 py-1 bg-muted border rounded-md flex items-center font-medium text-sm">
                              {capitalizeWords(detalle.producto_nombre)}
                              <div className="ml-auto text-right text-xs">
                                {(() => {
                                  const producto = productos.find(p => p.id === detalle.producto_id);
                                  const tieneDescuento = producto && producto.descuento_cantidad_minima && producto.descuento_precio_unitario && detalle.cantidad >= producto.descuento_cantidad_minima;
                                  
                                  if (tieneDescuento) {
                                    return (
                                      <>
                                        <span className="text-muted-foreground text-xs line-through">
                                          ${detalle.precio_unitario}
                                        </span>
                                          <div className="text-green-500 font-bold">
                                            ${producto.descuento_precio_unitario}
                                          </div>
                                      </>
                                    );
                                  } else {
                                    return (
                                      <span className="text-muted-foreground">
                                        ${detalle.precio_unitario} c/u
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="relative">
                                <Input
                                  ref={el => searchRefs.current[index] = el}
                                  placeholder="Buscar..."
                                  value={activeDetalleIndex === index ? productoSearchTerm : ''}
                                  onChange={(e) => {
                                    setProductoSearchTerm(e.target.value);
                                    setActiveDetalleIndex(index);
                                  }}
                                  onFocus={() => {
                                    setActiveDetalleIndex(index);
                                    setProductoSearchTerm('');
                                  }}
                                  onKeyDown={(e) => handleKeyDown(e, index)}
                                  className="h-7 text-sm pr-8"
                                />
                                {activeDetalleIndex === index && (
                                  <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3 pointer-events-none" />
                                )}
                                {activeDetalleIndex === index && productoSearchTerm && (
                                  <div className="absolute z-10 left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-auto">
                          {filteredProductos.length > 0 ? (
                             filteredProductos.map((producto, resultIndex) => (
                              <div
                                key={producto.id}
                                ref={el => resultRefs.current[resultIndex] = el}
                                className={`px-2 py-1.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors text-sm ${
                                  resultIndex === selectedResultIndex ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                                }`}
                                onClick={() => {
                                  actualizarDetalle(index, 'producto_id', producto.id);
                                  setProductoSearchTerm('');
                                  setActiveDetalleIndex(null);
                                  setSelectedResultIndex(0);
                                  resultRefs.current = [];
                                  setTimeout(() => {
                                    if (cantidadRefs.current[index]) {
                                      cantidadRefs.current[index].focus();
                                      cantidadRefs.current[index].select();
                                    }
                                  }, 100);
                                }}
                              >
                                <div>
                                  <span>{capitalizeWords(producto.nombre)} - ${producto.precio_unitario}</span>
                                  {producto.descuento_cantidad_minima && producto.descuento_precio_unitario && (
                                    <div className="text-xs text-green-600 font-medium">
                                      ≥{producto.descuento_cantidad_minima}: ${producto.descuento_precio_unitario}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              {productos.length === 0 
                                ? 'No hay productos' 
                                : 'Todos agregados o no coinciden'}
                            </div>
                          )}
                                  </div>
                                )}
                              </div>
                              </>
                          )}
                          </div>

                        {(!detalle.producto_id && !activeDetalleIndex === index) && (
                        <Select
                          value={detalle.producto_id}
                          onValueChange={(value) => actualizarDetalle(index, 'producto_id', value)}
                        >
                          <SelectTrigger className="h-7 text-sm" data-testid={`producto-select-${index}`}>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            {getProductosDisponibles().map(producto => (
                              <SelectItem key={producto.id} value={producto.id}>
                                {capitalizeWords(producto.nombre)} - ${producto.precio_unitario}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                        </div>
                        <div className="w-16">
                          <Input
                            ref={el => cantidadRefs.current[index] = el}
                            type="number"
                            min="1"
                            value={detalle.cantidad}
                            onChange={(e) => actualizarDetalle(index, 'cantidad', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setTimeout(() => {
                                  agregarDetalle();
                                }, 100);
                              }
                            }}
                            className="h-7 text-sm"
                            data-testid={`cantidad-input-${index}`}
                          />
                        </div>
                        <div className="w-24 text-right">
                          <div className="h-7 px-2 py-1 bg-background border rounded-md flex items-center justify-end font-semibold text-sm">
                            {formatCurrency(detalle.subtotal, showCents)}
                          </div>
                        </div>
                        <div className="w-8 flex justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => eliminarDetalle(index)}
                            data-testid={`remove-detalle-${index}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="py-3">
          <CardContent className="py-2">
            <div className="flex justify-between items-center mb-3">
              <span className="text-lg font-bold">Total:</span>
              <span className="text-2xl font-bold text-primary" data-testid="total-venta">
                {formatCurrency(calcularTotal(), showCents)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1 h-9"
                onClick={handleSubmit}
                disabled={loading || detalles.length === 0}
                data-testid="submit-venta-button"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                {loading ? 'Procesando...' : 'Registrar Venta'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="h-9"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default NuevaVenta;
