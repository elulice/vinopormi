import { useState, useEffect, useRef, useCallback } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ShoppingCart, RefreshCw, X, Split } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { capitalizeWords } from '@/lib/utils';
import { API } from '@/lib/config';
import ProductSearch from '@/components/ProductSearch';
import { apiGet, apiPost } from '@/lib/api';
import { actualizarCacheProductos, actualizarCacheClientes, obtenerTodosProductos, obtenerTodosClientes, guardarVentaOffline } from '@/db/offlineDB';

const DRAFT_KEY = 'nuevaVentaDraft';

const getEmptyDetalle = () => ({
  producto_id: '',
  producto_nombre: '',
  cantidad: 1,
  precio_unitario: 0,
  subtotal: 0
});

const getDefaultPagos = () => ([
  { medio: 'efectivo', monto: '' },
  { medio: 'transferencia', monto: '' }
]);

const loadVentaDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const NuevaVenta = () => {
  const { showCents, calcularVuelto: mostrarCalculadoraVuelto, totalFlotante, sidebarWidth } = useConfig();
  const navigate = useNavigate();
  const [draft] = useState(() => loadVentaDraft());
  const [productos, setProductos] = useState([]);

  const [clientes, setClientes] = useState([]);
  const [medioPago, setMedioPago] = useState('efectivo');
  const [clienteId, setClienteId] = useState(() => draft?.clienteId || '');
  const [detalles, setDetalles] = useState(() => {
    if (Array.isArray(draft?.detalles) && draft.detalles.length > 0) {
      return draft.detalles.map((d) => ({
        producto_id: d?.producto_id || '',
        producto_nombre: d?.producto_nombre || '',
        cantidad: Number(d?.cantidad) > 0 ? Number(d.cantidad) : 1,
        precio_unitario: Number(d?.precio_unitario) || 0,
        subtotal: Number(d?.subtotal) || 0,
      }));
    }
    return [getEmptyDetalle()];
  });
  const [loading, setLoading] = useState(false);
  const [refreshingProductos, setRefreshingProductos] = useState(false);

  // Estado para múltiples pagos
  const [pagos, setPagos] = useState(() => {
    if (Array.isArray(draft?.pagos) && draft.pagos.length >= 2) {
      return [
        { medio: draft.pagos[0]?.medio || 'efectivo', monto: draft.pagos[0]?.monto ?? '' },
        { medio: draft.pagos[1]?.medio || 'transferencia', monto: draft.pagos[1]?.monto ?? '' },
      ];
    }
    return getDefaultPagos();
  });
  const [multiplesPagos, setMultiplesPagos] = useState(() => Boolean(draft?.multiplesPagos));
  
  // Estado para cálculo de vuelto
  const [pagaCon, setPagaCon] = useState(() => draft?.pagaCon ?? '');
  
  // Estado para ajustes de venta
  const [ajusteMonto, setAjusteMonto] = useState(() => draft?.ajusteMonto ?? '');
  const [ajusteDetalle, setAjusteDetalle] = useState(() => draft?.ajusteDetalle ?? '');
  
  const searchRefs = useRef([]); // Instancias de ProductSearch (focus/clear)
  const cantidadRefs = useRef([]);
  const formRef = useRef(null);

  // Mantener el scroll siempre al final de la página al agregar productos
  const prevDetallesLength = useRef(detalles.length);
  useEffect(() => {
    const added = detalles.length > prevDetallesLength.current;
    prevDetallesLength.current = detalles.length;
    if (!added || detalles.length === 0) return;
    // Scroll al final de la página
    const timer = setTimeout(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [detalles.length]);

  // Dar foco al primer buscador cuando llega el catálogo (solo una vez).
  const initialFocusSet = useRef(false);
  useEffect(() => {
    if (initialFocusSet.current || productos.length === 0) return undefined;
    const timer = setTimeout(() => {
      searchRefs.current[0]?.focus();
      initialFocusSet.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, [productos]);

  const fetchProductos = useCallback(async () => {
    try {
      const res = await apiGet(`${API}/productos-paginados?limit=1000`);
      setProductos(res.data.productos);
      try {
        await actualizarCacheProductos(res.data.productos);
      } catch (cacheError) {
        console.warn('Error guardando caché de productos:', cacheError);
      }
    } catch (error) {
      const cachedProductos = await obtenerTodosProductos();
      if (cachedProductos.length > 0) {
        setProductos(cachedProductos);
        toast.warning('Modo Offline: Mostrando precios en caché');
      } else {
        toast.error('Error al cargar productos');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProductos = async () => {
    setRefreshingProductos(true);
    try {
      const res = await apiGet(`${API}/productos-paginados?limit=1000`);
      setProductos(res.data.productos);
      await actualizarCacheProductos(res.data.productos);
      toast.success('Lista de productos actualizada');
    } catch (error) {
      toast.error('Error al actualizar productos');
    } finally {
      setRefreshingProductos(false);
    }
  };

  const fetchClientes = useCallback(async () => {
    try {
      const response = await apiGet(`${API}/clientes`);
      setClientes(response.data);
      await actualizarCacheClientes(response.data);
    } catch (error) {
      const cachedClientes = await obtenerTodosClientes();
      if (cachedClientes.length > 0) {
        setClientes(cachedClientes);
      } else {
        toast.error('Error al cargar clientes');
      }
    }
  }, []);

  useEffect(() => {
    fetchProductos();
    fetchClientes();
  }, [fetchClientes, fetchProductos]);

  // Calcular total de la venta
  const calcularTotal = useCallback(() => {
    const subtotal = detalles.reduce((sum, d) => sum + d.subtotal, 0);
    const ajuste = ajusteMonto === '' || ajusteMonto === null ? 0 : parseFloat(ajusteMonto);
    return subtotal + ajuste;
  }, [detalles, ajusteMonto]);

  // Efecto para actualizar los montos cuando cambian los productos
  useEffect(() => {
    const total = calcularTotal();
    
    setPagos(prev => {
      const nuevosPagos = [...prev];
      
      // Si no hay productos, reiniciar los montos
      if (total <= 0) {
        nuevosPagos[0].monto = '';
        nuevosPagos[1].monto = '';
        return nuevosPagos;
      }
      
      // Verificar si hay campos vacíos (recién limpiados manualmente)
      const campo0Vacio = nuevosPagos[0].monto === '' || nuevosPagos[0].monto === null;
      const campo1Vacio = nuevosPagos[1].monto === '' || nuevosPagos[1].monto === null;
      
      // Solo auto-calcular si múltiples pagos está activo
      if (multiplesPagos) {
        const monto0 = campo0Vacio ? 0 : nuevosPagos[0].monto;
        const monto1 = campo1Vacio ? 0 : nuevosPagos[1].monto;
        
        // Si hay monto en el segundo campo y el primero no está vacío, recalcular el primero
        if (monto1 > 0 && !campo0Vacio) {
          if (total >= monto1) {
            nuevosPagos[0].monto = parseFloat((total - monto1).toFixed(2));
          }
        } 
        // Si solo hay monto en el primero y el segundo no está vacío, recalcular
        else if (monto0 > 0 && !campo1Vacio) {
          nuevosPagos[1].monto = parseFloat((total - monto0).toFixed(2));
        }
        // Si ambos están vacíos, poner el total en el primero
        else if (campo0Vacio && campo1Vacio) {
          nuevosPagos[0].monto = total;
        }
      } else {
        // Modo simple: siempre poner el total en el primer campo
        nuevosPagos[0].monto = total;
        // Limpiar el segundo campo en modo simple
        nuevosPagos[1].monto = '';
      }
      
      return nuevosPagos;
    });
  }, [detalles, multiplesPagos, calcularTotal]);

  // Actualizar monto de un pago específico con auto-cálculo del otro campo
  const actualizarPagoMonto = (index, value) => {
    // Limpiar ceros a la izquierda
    let valorLimpio = value;
    if (value && value.length > 1 && value.startsWith('0') && value[1] !== '.') {
      valorLimpio = value.replace(/^0+/, '');
      if (valorLimpio === '') valorLimpio = '0';
    }
    
    const montoIngresado = valorLimpio === '' ? '' : parseFloat(valorLimpio);
    const total = calcularTotal();
    
    setPagos(prev => {
      const nuevosPagos = [...prev];
      const otroIndex = index === 0 ? 1 : 0;
      
      // Si se borra el monto (vacío), poner el total en el otro campo (solo si múltiples pagos activo)
      if (montoIngresado === '') {
        nuevosPagos[index] = { ...nuevosPagos[index], monto: '' };
        if (multiplesPagos && nuevosPagos[otroIndex].medio) {
          nuevosPagos[otroIndex].monto = total;
        }
      } else if (!isNaN(montoIngresado)) {
        // Validar que el monto no supere el total
        let montoValidado = montoIngresado;
        if (montoIngresado > total) {
          montoValidado = total;
          toast.error(`El monto no puede superar el total de $${total.toFixed(2)}`);
        }
        
        // Si hay un monto válido, actualizar
        nuevosPagos[index] = { ...nuevosPagos[index], monto: montoValidado };
        
        // Solo auto-calcular el otro campo si múltiples pagos está activo
        if (multiplesPagos) {
          const remanente = total - montoValidado;
          if (remanente >= 0) {
            nuevosPagos[otroIndex].monto = parseFloat(remanente.toFixed(2));
          } else {
            nuevosPagos[otroIndex].monto = 0;
          }
        }
      }
      
      return nuevosPagos;
    });
  };

  // Actualizar medio de pago (no permitir duplicados)
  const actualizarPagoMedio = (index, medio) => {
    setPagos(prev => {
      const nuevosPagos = [...prev];
      const otroIndex = index === 0 ? 1 : 0;
      
      // Si el otro tiene el mismo medio, limpiarlo
      if (prev[otroIndex].medio === medio) {
        nuevosPagos[otroIndex] = { ...nuevosPagos[otroIndex], medio: '' };
      }
      
      nuevosPagos[index] = { ...nuevosPagos[index], medio };
      return nuevosPagos;
    });
  };

  // Obtener medios de pago disponibles para un select
  const getMediosDisponibles = (index) => {
    const medios = ['efectivo', 'posnet', 'transferencia', 'cuenta_corriente'];
    
    // Solo filtrar cuando está en modo múltiples pagos
    if (!multiplesPagos) {
      return medios;
    }
    
    const otroMedio = index === 0 ? pagos[1].medio : pagos[0].medio;
    return medios.filter(m => m !== otroMedio);
  };

  // Obtener monto total de pagos (solo los visibles)
  const getTotalPagos = () => {
    const pagosAConsiderar = multiplesPagos ? pagos : [pagos[0]];
    return pagosAConsiderar.reduce((sum, p) => sum + (p.monto === '' || p.monto === null ? 0 : p.monto), 0);
  };

  // Obtener diferencia (pendiente)
  const getDiferencia = () => {
    return calcularTotal() - getTotalPagos();
  };

  // Verificar si los pagos cuadran
  const pagosCuadran = () => {
    return Math.abs(getDiferencia()) < 0.01;
  };

  // Verificar si hay efectivo en los pagos
  const hayEfectivo = () => {
    return pagos.some(p => p.medio === 'efectivo');
  };

  // Calcular vuelto
  const calcularVuelto = () => {
    if (!pagaCon || pagaCon === '') return 0;
    const monto = parseFloat(pagaCon);
    if (isNaN(monto)) return 0;
    return monto - calcularTotal();
  };

  const seleccionarProducto = (index, producto) => {
    actualizarDetalle(index, 'producto_id', producto.id);
    // Focus en la cantidad después de elegir, igual que antes.
    setTimeout(() => {
      cantidadRefs.current[index]?.focus();
      cantidadRefs.current[index]?.select();
    }, 100);
  };

  const agregarDetalle = () => {
    // Buscar si hay un item vacío (sin producto seleccionado)
    const emptyIndex = detalles.findIndex(detalle => !detalle.producto_id);
    
    if (emptyIndex !== -1) {
      // Si hay un item vacío, hacer focus en su campo de búsqueda
      searchRefs.current[emptyIndex]?.clear();
      setTimeout(() => searchRefs.current[emptyIndex]?.focus(), 100);
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
      // Focus on search field after adding new row
      setTimeout(() => searchRefs.current[newDetalleIndex]?.focus(), 100);
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

  const resetForm = (options = {}) => {
    const { clearDraft = true } = options;
    if (clearDraft) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    }
    setDetalles([getEmptyDetalle()]);
    setMedioPago('efectivo');
    setClienteId('');
    searchRefs.current.forEach((buscador) => buscador?.clear());
    setPagos(getDefaultPagos());
    setMultiplesPagos(false);
    setAjusteMonto('');
    setAjusteDetalle('');
    setPagaCon('');
    // Auto-focus on first product search field
    setTimeout(() => {
      if (searchRefs.current[0]) {
        searchRefs.current[0].focus();
      }
    }, 100);
  };

  // Persistir borrador para no perder datos al cambiar de pantalla
  useEffect(() => {
    const isEmptyDraft =
      (!Array.isArray(detalles) || detalles.length === 0 || (detalles.length === 1 && !detalles[0]?.producto_id && !detalles[0]?.producto_nombre && (Number(detalles[0]?.cantidad) || 1) === 1 && !detalles[0]?.subtotal)) &&
      !clienteId &&
      !multiplesPagos &&
      (pagos?.[0]?.medio || 'efectivo') === 'efectivo' && (pagos?.[0]?.monto === '' || pagos?.[0]?.monto === null || pagos?.[0]?.monto === undefined) &&
      (pagos?.[1]?.medio || 'transferencia') === 'transferencia' && (pagos?.[1]?.monto === '' || pagos?.[1]?.monto === null || pagos?.[1]?.monto === undefined) &&
      (ajusteMonto === '' || ajusteMonto === null || ajusteMonto === undefined) &&
      !ajusteDetalle &&
      (pagaCon === '' || pagaCon === null || pagaCon === undefined);

    try {
      if (isEmptyDraft) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ detalles, pagos, multiplesPagos, clienteId, ajusteMonto, ajusteDetalle, pagaCon })
        );
      }
    } catch {}
  }, [detalles, pagos, multiplesPagos, clienteId, ajusteMonto, ajusteDetalle, pagaCon]);

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
      const cantidad = Math.max(1, parseInt(value) || 1);
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

  const isProductoYaAgregado = useCallback((productoId) => {
    return detalles.some(detalle => detalle.producto_id === productoId);
  }, [detalles]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out empty rows and check only valid products
    const productosValidos = detalles.filter(d => d.producto_id && d.cantidad > 0);
    
    if (productosValidos.length === 0) {
      toast.error('Agrega al menos un producto válido');
      return;
    }

    // Validar que los pagos cuadren
    if (!pagosCuadran()) {
      toast.error('Los montos de pago no cuadran con el total');
      return;
    }

    // Validar que haya al menos un medio de pago seleccionado
    const pagosAMostrar = multiplesPagos ? pagos : [pagos[0]];
    const pagosValidos = pagosAMostrar.filter(p => p.medio && p.monto > 0);
    if (pagosValidos.length === 0) {
      toast.error('Ingresa al menos un medio de pago');
      return;
    }

    // Validar cliente si hay cuenta corriente
    const tieneCuentaCorriente = pagosAMostrar.some(p => p.medio === 'cuenta_corriente');
    if (tieneCuentaCorriente && !clienteId) {
      toast.error('Selecciona un cliente para cuenta corriente');
      return;
    }

    setLoading(true);

    const data = {
      pagos: pagosAMostrar.filter(p => p.medio && p.monto > 0).map(p => ({
        medio_pago: p.medio,
        monto: parseFloat(p.monto)
      })),
      cliente_id: tieneCuentaCorriente ? clienteId : null,
      detalles: productosValidos.map(d => {
        const producto = productos.find(p => p.id === d.producto_id);
        let precioUnitarioAplicado = d.precio_unitario;
        
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
      }),
      ajuste_monto: ajusteMonto === '' || ajusteMonto === null ? 0 : parseFloat(ajusteMonto),
      ajuste_detalle: ajusteDetalle || null
    };

    try {
      await apiPost(`${API}/ventas`, data);
      
      toast.success('Venta registrada exitosamente');
      resetForm({ clearDraft: true });
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.response?.status >= 500 || error.response?.status === 0 || !error.response) {
        await guardarVentaOffline(data);
        toast.success('⚠️ Servidor inaccesible. Venta guardada localmente. Se sincronizará cuando vuelva la conexión.');
        resetForm({ clearDraft: true });
      } else {
        toast.error(error.response?.data?.detail || 'Error al registrar venta');
      }
    } finally {
      setLoading(false);
    }
  };

  const fixedBarMargin = sidebarWidth === 'compact' ? 'lg:left-24' : 'lg:left-60';

  return (
    <div className={totalFlotante ? 'space-y-4 pb-10' : 'space-y-4'}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Venta</h1>
        <p className="text-sm text-muted-foreground">Registra una nueva venta</p>
      </div>

      <form ref={formRef} className="space-y-4">
        <Card className="py-2">
          <CardHeader className="py-1 px-4">
            <CardTitle className="text-base">Información de la Venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 py-1 px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Medios de Pago</Label>
                  <div className="flex bg-muted rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => setMultiplesPagos(false)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        !multiplesPagos ? 'bg-background shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      onClick={() => setMultiplesPagos(true)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        multiplesPagos ? 'bg-background shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      Múltiple
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {/* Primer pago - siempre visible */}
                  <div className="flex gap-2 items-center">
                    <Select 
                      value={pagos[0].medio} 
                      onValueChange={(value) => actualizarPagoMedio(0, value)}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="Medio" />
                      </SelectTrigger>
                      <SelectContent>
                        {getMediosDisponibles(0).map(medio => (
                          <SelectItem key={medio} value={medio}>
                            {medio === 'efectivo' ? 'Efectivo' : 
                             medio === 'posnet' ? 'PosNet' : 
                             medio === 'transferencia' ? 'Transferencia' : 'Cta. Cte.'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={pagos[0].monto}
                          onChange={(e) => actualizarPagoMonto(0, e.target.value)}
                          onKeyDown={(e) => {
                            // Permitir: teclas de control, números, punto decimal
                            const permitidas = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
                            if (permitidas.includes(e.key)) return;
                            if (/^[0-9.]$/.test(e.key)) return;
                            e.preventDefault();
                          }}
                          readOnly={!multiplesPagos}
                          className={`h-8 pl-5 pr-7 text-xs [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none ${!multiplesPagos ? 'bg-muted/30' : 'bg-background border-input'}`}
                        />
                        {multiplesPagos && (pagos[0].monto || pagos[0].monto === 0) && pagos[0].monto !== '' && (
                          <button
                            type="button"
                            onClick={() => actualizarPagoMonto(0, '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                  </div>
                  
                  {/* Segundo pago - solo visible cuando múltiples pagos está activo */}
                  {multiplesPagos && (
                    <div className="flex gap-2 items-center">
                      <Select 
                        value={pagos[1].medio} 
                        onValueChange={(value) => actualizarPagoMedio(1, value)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="Medio" />
                        </SelectTrigger>
                        <SelectContent>
                          {getMediosDisponibles(1).map(medio => (
                            <SelectItem key={medio} value={medio}>
                              {medio === 'efectivo' ? 'Efectivo' : 
                               medio === 'posnet' ? 'PosNet' : 
                               medio === 'transferencia' ? 'Transferencia' : 'Cta. Cte.'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={pagos[1].monto}
                          onChange={(e) => actualizarPagoMonto(1, e.target.value)}
                          onKeyDown={(e) => {
                            // Permitir: teclas de control, números, punto decimal
                            const permitidas = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
                            if (permitidas.includes(e.key)) return;
                            if (/^[0-9.]$/.test(e.key)) return;
                            e.preventDefault();
                          }}
                          className="h-8 pl-5 pr-7 text-xs [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {(pagos[1].monto || pagos[1].monto === 0) && pagos[1].monto !== '' && (
                          <button
                            type="button"
                            onClick={() => actualizarPagoMonto(1, '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Totales */}
                  <div className="flex justify-between items-center pt-2 border-t text-xs">
                    <div>
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-semibold">{formatCurrency(calcularTotal(), showCents)}</span>
                    </div>
                    <div className={pagosCuadran() ? 'text-green-600' : 'text-red-500'}>
                      {pagosCuadran() ? '✓ Cuadrado' : `Pendiente: ${formatCurrency(getDiferencia(), showCents)}`}
                    </div>
                  </div>
                </div>
              </div>

              {(pagos[0].medio === 'cuenta_corriente' || pagos[1].medio === 'cuenta_corriente') && (
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

        <Card className="py-2">
          <CardHeader className="py-1 px-4">
            <div className="flex justify-between items-center">
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
          <CardContent className="py-1 px-4">
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
                            <ProductSearch
                              ref={(elemento) => { searchRefs.current[index] = elemento; }}
                              productos={productos}
                              excludeIds={detalles.map((item) => item.producto_id).filter(Boolean)}
                              onSelect={(producto) => seleccionarProducto(index, producto)}
                              inputId={`producto-search-${index}`}
                              inputName={`producto-search-${index}`}
                            />
                          )}
                          </div>
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
            <div className="mt-3 pt-3 border-t">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="ajuste-monto" className="text-xs text-muted-foreground">
                    Descuento/Recargo
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      id="ajuste-monto"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={ajusteMonto}
                      onChange={(e) => setAjusteMonto(e.target.value)}
                      className={`h-7 pl-5 pr-6 text-xs [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none ${
                        ajusteMonto && parseFloat(ajusteMonto) < 0 ? 'border-green-500 text-green-600' : 
                        ajusteMonto && parseFloat(ajusteMonto) > 0 ? 'border-red-500 text-red-600' : ''
                      }`}
                    />
                    {ajusteMonto && (
                      <button
                        type="button"
                        onClick={() => { setAjusteMonto(''); setAjusteDetalle(''); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-[2] min-w-[200px]">
                  <Label htmlFor="ajuste-detalle" className="text-xs text-muted-foreground">
                    Detalle
                  </Label>
                  <Input
                    id="ajuste-detalle"
                    type="text"
                    placeholder="Motivo (opcional)"
                    value={ajusteDetalle}
                    onChange={(e) => setAjusteDetalle(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                {ajusteMonto && parseFloat(ajusteMonto) !== 0 && (
                  <div className={`flex items-center px-2 py-1 rounded text-xs font-medium ${parseFloat(ajusteMonto) < 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {parseFloat(ajusteMonto) < 0 ? 'Desc:' : 'Rec:'} {parseFloat(ajusteMonto) < 0 ? '-' : '+'}{formatCurrency(Math.abs(parseFloat(ajusteMonto)), showCents)}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculadora de Vuelto - Solo visible cuando hay efectivo y está habilitada */}
        {mostrarCalculadoraVuelto && hayEfectivo() && (
          <Card className="py-2 border-2 border-blue-200 bg-blue-50/50 dark:border-blue-400/50 dark:bg-blue-950/40">
            <CardHeader className="py-1 px-4">
              <CardTitle className="text-sm text-blue-800 dark:text-blue-300">Cálculo de Vuelto</CardTitle>
            </CardHeader>
            <CardContent className="py-1 px-4">
              <div className="flex flex-col sm:flex-row gap-2 items-end">
                <div className="flex-1 w-full">
                  <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block">Paga con</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 font-semibold text-xs">$</span>
                    <Input
                      type="number"
                      step="100"
                      min="0"
                      placeholder="0"
                      value={pagaCon}
                      onChange={(e) => setPagaCon(e.target.value)}
                      className="h-7 pl-5 pr-6 text-sm font-semibold border-blue-300 focus:border-blue-500 bg-white dark:bg-background dark:border-blue-500/60 [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPagaCon('10000')}
                    className="px-2 py-1 text-xs rounded border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-background dark:text-muted-foreground dark:border-border dark:hover:bg-muted font-medium"
                  >
                    $10.000
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagaCon('20000')}
                    className="px-2 py-1 text-xs rounded border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-background dark:text-muted-foreground dark:border-border dark:hover:bg-muted font-medium"
                  >
                    $20.000
                  </button>
                </div>
              </div>

              {/* Resultado del vuelto */}
              {pagaCon && parseFloat(pagaCon) > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-400/50">
                  {calcularVuelto() >= 0 ? (
                    <div className="text-center flex items-center justify-center gap-2 flex-wrap">
                      <p className="text-blue-600 dark:text-blue-400 text-sm">Vuelto</p>
                      <p className="font-['Manrope'] text-2xl font-bold text-blue-800 dark:text-blue-300">
                        ${calcularVuelto().toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-red-500 text-sm font-medium">
                        Faltan: ${Math.abs(calcularVuelto()).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {totalFlotante ? (
          <div className={`fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border shadow-lg p-3 ${fixedBarMargin}`}>
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:flex-1">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-2xl font-bold text-primary" data-testid="total-venta">
                  {formatCurrency(calcularTotal(), showCents)}
                </span>
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  className="flex-1 sm:flex-none h-9"
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
                  onClick={() => resetForm({ clearDraft: true })}
                  className="flex-1 sm:flex-none h-9"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Card className="py-2">
            <CardContent className="py-1 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:flex-1">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-primary" data-testid="total-venta">
                    {formatCurrency(calcularTotal(), showCents)}
                  </span>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <Button
                    type="button"
                    className="flex-1 sm:flex-none h-9"
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
                    onClick={() => resetForm({ clearDraft: true })}
                    className="flex-1 sm:flex-none h-9"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
};

export default NuevaVenta;
