import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ShoppingCart, Search } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NuevaVenta = () => {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
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
  const [activeDetalleIndex, setActiveDetalleIndex] = useState(null);
  const searchRefs = useRef([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const cantidadRefs = useRef([]);

  useEffect(() => {
    fetchProductos();
    fetchClientes();
  }, []);

  // Set initial focus on first product search field after component loads
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchRefs.current[0] && productos.length > 0) {
        searchRefs.current[0].focus();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [productos]);

  useEffect(() => {
    const filtered = productos.filter(producto =>
      producto.nombre.toLowerCase().includes(productoSearchTerm.toLowerCase())
    );
    setFilteredProductos(filtered);
    setSelectedResultIndex(0); // Reset selected index when search changes
  }, [productos, productoSearchTerm]);

  const fetchProductos = async () => {
    try {
      const response = await axios.get(`${API}/productos`, {
        headers: getAuthHeader()
      });
      setProductos(response.data);
    } catch (error) {
      toast.error('Error al cargar productos');
    }
  };

  const fetchClientes = async () => {
    try {
      const response = await axios.get(`${API}/clientes`, {
        headers: getAuthHeader()
      });
      setClientes(response.data);
    } catch (error) {
      toast.error('Error al cargar clientes');
    }
  };

  const handleKeyDown = (e, index) => {
    if (!activeDetalleIndex === index || !productoSearchTerm) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedResultIndex(prev => 
          prev < filteredProductos.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedResultIndex(prev => prev > 0 ? prev - 1 : 0);
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
        break;
    }
  };

  const agregarDetalle = () => {
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
  };

  const eliminarDetalle = (index) => {
    setDetalles(detalles.filter((_, i) => i !== index));
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

  const calcularTotal = () => {
    return detalles.reduce((sum, d) => sum + d.subtotal, 0);
  };

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
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Nueva Venta</h1>
        <p className="text-muted-foreground">Registra una nueva venta</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información de la Venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="medio_pago">Medio de Pago</Label>
                <Select value={medioPago} onValueChange={setMedioPago}>
                  <SelectTrigger id="medio_pago" data-testid="medio-pago-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="cuenta_corriente">Cuenta Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {medioPago === 'cuenta_corriente' && (
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger id="cliente" data-testid="cliente-select">
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

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Productos</CardTitle>
              <Button type="button" onClick={agregarDetalle} size="sm" data-testid="add-detalle-button">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {detalles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay productos. Agrega uno para empezar.
              </p>
            ) : (
              <div className="space-y-4">
                {detalles.map((detalle, index) => (
                   <div key={index} className="flex gap-4 items-end p-4 bg-muted rounded-lg" data-testid={`detalle-${index}`}>
                    <div className="flex-1 space-y-2">
                      <Label>Producto</Label>
                      <div className="relative">
                        <Input
                          ref={el => searchRefs.current[index] = el}
                          placeholder="Buscar producto..."
                          value={activeDetalleIndex === index ? productoSearchTerm : (detalle.producto_id ? productos.find(p => p.id === detalle.producto_id)?.nombre : '')}
                          onChange={(e) => {
                            setProductoSearchTerm(e.target.value);
                            setActiveDetalleIndex(index);
                          }}
                          onFocus={() => {
                            setActiveDetalleIndex(index);
                            setProductoSearchTerm('');
                          }}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          className="pr-4"
                        />
                        {activeDetalleIndex === index && (
                          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                        )}
                      </div>
                      {activeDetalleIndex === index && productoSearchTerm && (
                        <div className="relative z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                          {filteredProductos.slice(0, 8).map((producto, resultIndex) => (
                            <div
                              key={producto.id}
                              className={`px-3 py-2 hover:bg-muted cursor-pointer flex justify-between items-center ${
                                resultIndex === selectedResultIndex ? 'bg-muted' : ''
                              }`}
                              onClick={() => {
                                actualizarDetalle(index, 'producto_id', producto.id);
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
                              }}
                            >
                              <div>
                                <span>{producto.nombre} - ${producto.precio_unitario}</span>
                                <div className="text-sm text-muted-foreground">
                                  {producto.descuento_cantidad_minima && producto.descuento_precio_unitario && (
                                    <div className="text-xs text-green-600 font-medium">
                                      ≥{producto.descuento_cantidad_minima}: ${producto.descuento_precio_unitario} c/u
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredProductos.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No se encontraron productos
                            </div>
                          )}
                        </div>
                      )}
                      {!activeDetalleIndex === index && detalle.producto_id && (
                        <Select
                          value={detalle.producto_id}
                          onValueChange={(value) => actualizarDetalle(index, 'producto_id', value)}
                        >
                          <SelectTrigger className="w-full" data-testid={`producto-select-${index}`}>
                            <SelectValue placeholder="Selecciona un producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {productos.map(producto => (
                              <SelectItem key={producto.id} value={producto.id}>
                                {producto.nombre} - ${producto.precio_unitario}
                                {producto.descuento_cantidad_minima && producto.descuento_precio_unitario 
                                  ? ` (≥${producto.descuento_cantidad_minima}: $${producto.descuento_precio_unitario})`
                                  : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {(!detalle.producto_id && !activeDetalleIndex === index) && (
                        <Select
                          value={detalle.producto_id}
                          onValueChange={(value) => actualizarDetalle(index, 'producto_id', value)}
                        >
                          <SelectTrigger className="w-full" data-testid={`producto-select-${index}`}>
                            <SelectValue placeholder="Selecciona un producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {productos.map(producto => (
                              <SelectItem key={producto.id} value={producto.id}>
                                {producto.nombre} - ${producto.precio_unitario}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        ref={el => cantidadRefs.current[index] = el}
                        type="number"
                        min="1"
                        value={detalle.cantidad}
                        onChange={(e) => actualizarDetalle(index, 'cantidad', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Add new product row and focus on search field
                            setTimeout(() => {
                              agregarDetalle();
                            }, 100);
                          }
                        }}
                        data-testid={`cantidad-input-${index}`}
                      />
                    </div>
                      <div className="w-32 space-y-2">
                        <Label>Subtotal</Label>
                        <div className="h-10 px-3 py-2 bg-background border rounded-md flex items-center font-semibold">
                          ${detalle.subtotal.toFixed(2)}
                        </div>
                        {(() => {
                          const producto = productos.find(p => p.id === detalle.producto_id);
                          if (producto && producto.descuento_cantidad_minima && producto.descuento_precio_unitario && detalle.cantidad >= producto.descuento_cantidad_minima) {
                            return (
                              <div className="text-xs text-green-600 font-medium">
                                ¡Descuento aplicado!
                                <br />
                                ${producto.descuento_precio_unitario} c/u
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => eliminarDetalle(index)}
                      data-testid={`remove-detalle-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-6">
              <span className="text-2xl font-bold">Total:</span>
              <span className="text-3xl font-bold text-primary" data-testid="total-venta">
                ${calcularTotal().toFixed(2)}
              </span>
            </div>
            <div className="flex gap-4">
              <Button
                type="submit"
                className="flex-1"
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