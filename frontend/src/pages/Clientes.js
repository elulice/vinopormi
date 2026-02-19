import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Users, CreditCard, TrendingUp, TrendingDown, ArrowLeft, ShoppingCart, List, Search, X } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { capitalizeWords } from '@/lib/utils';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';

const Clientes = () => {
  const { getAuthHeader } = useAuth();
  const { showCents } = useConfig();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false);
  const [movimientoDialogOpen, setMovimientoDialogOpen] = useState(false);
  const [ventaDialogOpen, setVentaDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [loadingVenta, setLoadingVenta] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [cuentaInfo, setCuentaInfo] = useState(null);
  const [loadingCuenta, setLoadingCuenta] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: ''
  });
  const [movimientoData, setMovimientoData] = useState({
    concepto: '',
    monto: ''
  });
  const [movimientosTodos, setMovimientosTodos] = useState([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  const [activeTab, setActiveTab] = useState('clientes');

  const fetchClientes = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/clientes`, {
        headers: getAuthHeader()
      });
      setClientes(response.data);
    } catch (error) {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const fetchMovimientosTodos = useCallback(async () => {
    setLoadingMovimientos(true);
    try {
      const response = await axios.get(`${API}/movimientos-todos`, {
        headers: getAuthHeader()
      });
      setMovimientosTodos(response.data);
    } catch (error) {
      toast.error('Error al cargar movimientos');
    } finally {
      setLoadingMovimientos(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    if (activeTab === 'movimientos' && movimientosTodos.length === 0) {
      fetchMovimientosTodos();
    }
  }, [activeTab, fetchMovimientosTodos, movimientosTodos.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      nombre: formData.nombre,
      telefono: formData.telefono,
      email: formData.email
    };

    try {
      if (editingCliente) {
        await axios.put(`${API}/clientes/${editingCliente.id}`, data, {
          headers: getAuthHeader()
        });
        toast.success('Cliente actualizado');
      } else {
        await axios.post(`${API}/clientes`, data, {
          headers: getAuthHeader()
        });
        toast.success('Cliente creado');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchClientes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar cliente');
    }
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este cliente?')) return;
    
    try {
      await axios.delete(`${API}/clientes/${id}`, {
        headers: getAuthHeader()
      });
      toast.success('Cliente eliminado');
      fetchClientes();
    } catch (error) {
      toast.error('Error al eliminar cliente');
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', telefono: '', email: '' });
    setEditingCliente(null);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleViewCuenta = async (cliente) => {
    setSelectedCliente(cliente);
    setCuentaDialogOpen(true);
    setLoadingCuenta(true);
    
   try {
      const response = await axios.get(
        `${API}/clientes/${cliente.id}/cuenta-corriente`,
        { headers: getAuthHeader() }
      );
      setCuentaInfo(response.data);
    } catch (error) {
      toast.error('Error al cargar cuenta corriente');
    } finally {
      setLoadingCuenta(false);
    }
  };

  const hasChanges = editingCliente && (
    formData.nombre !== editingCliente.nombre ||
    formData.telefono !== editingCliente.telefono ||
    formData.email !== (editingCliente.email || '')
  );

  const handleMovimientoSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(
        `${API}/clientes/${selectedCliente.id}/movimientos?concepto=${encodeURIComponent(movimientoData.concepto)}&monto=${parseFloat(movimientoData.monto)}`,
        {},
        { headers: getAuthHeader() }
      );
      
      toast.success('Movimiento registrado');
      setMovimientoDialogOpen(false);
      setMovimientoData({ concepto: '', monto: '' });
      
      // Recargar cuenta corriente
      const response = await axios.get(
        `${API}/clientes/${selectedCliente.id}/cuenta-corriente`,
        { headers: getAuthHeader() }
      );
      setCuentaInfo(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar movimiento');
    }
  };

  const handleCuentaDialogClose = () => {
    setCuentaDialogOpen(false);
    setSelectedCliente(null);
    setCuentaInfo(null);
  };

  const handleViewVenta = async (movimiento) => {
    // Usar directamente el campo venta_id que ahora incluye el backend
    const ventaId = movimiento.venta_id;
    
    if (!ventaId) {
      return;
    }
    
    setSelectedVenta(null);
    setVentaDialogOpen(true);
    setLoadingVenta(true);
    
    try {
      const response = await axios.get(`${API}/ventas/${ventaId}`, {
        headers: getAuthHeader()
      });
      setSelectedVenta(response.data);
    } catch (error) {
      toast.error('Error al cargar detalles de la venta');
      setVentaDialogOpen(false);
    } finally {
      setLoadingVenta(false);
    }
  };

  const handleVentaDialogClose = () => {
    setVentaDialogOpen(false);
    setSelectedVenta(null);
  };

  const filteredClientes = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefono.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredMovimientos = movimientosTodos.filter((m) =>
    m.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.concepto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cuentas Corrientes</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus clientes y sus cuentas corrientes</p>
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 text-xs" onClick={() => resetForm()} data-testid="add-cliente-button">
              <Plus className="w-3 h-3 mr-1" />
              Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </DialogTitle>
              <DialogDescription>
                {editingCliente ? 'Modifica los datos del cliente seleccionado' : 'Completa los datos para crear un nuevo cliente'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="nombre" className="text-xs">Nombre</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="h-8"
                  data-testid="cliente-nombre-input"
                />
              </div>
              <div>
                <Label htmlFor="teléfono" className="text-xs">Teléfono (opcional)</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="h-8"
                  data-testid="cliente-telefono-input"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs">Email (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-8"
                  data-testid="cliente-email-input"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  className="flex-1 h-8"
                  data-testid="cliente-submit-button"
                  disabled={editingCliente && !hasChanges}
                >
                  {editingCliente ? 'Actualizar' : 'Crear'}
                </Button>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="clientes" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="clientes" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">
          <ResponsiveTable
        headers={[
          { title: 'Cliente', width: '40%' },
          { title: 'Saldo', width: '35%' },
          { title: 'Acciones', width: '25%' }
        ]}
        rows={filteredClientes}
        renderDesktopRow={(cliente, index) => (
          <tr key={cliente.id} className="border-b" data-testid={`cliente-card-${cliente.id}`}>
            <td className="p-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-3 h-3 text-secondary" />
                <span className="truncate">{cliente.nombre}</span>
              </div>
            </td>
            <td className="p-2">
              <div className={`text-sm font-semibold ${
                cliente.saldo < 0 ? 'text-destructive' : 'text-green-600'
              }`}>
                {formatCurrency(Math.abs(cliente.saldo || 0), showCents)}
                {cliente.saldo < 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">(debe)</span>
                )}
                {cliente.saldo > 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">(a favor)</span>
                )}
              </div>
            </td>
            <td className="p-2 text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1"
                  onClick={() => handleViewCuenta(cliente)}
                  data-testid={`view-cuenta-${cliente.id}`}
                >
                  <CreditCard className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1"
                  onClick={() => handleEdit(cliente)}
                  data-testid={`edit-cliente-${cliente.id}`}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1 text-destructive"
                  onClick={() => handleDelete(cliente.id)}
                  data-testid={`delete-cliente-${cliente.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(cliente, index) => (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-secondary/10 rounded flex items-center justify-center">
                <Users className="w-4 h-4 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm truncate">{cliente.nombre}</h3>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Saldo: </span>
              <span className={`font-semibold ${
                cliente.saldo < 0 ? 'text-destructive' : 'text-green-600'
              }`}>
                {formatCurrency(Math.abs(cliente.saldo || 0), showCents)}
                {cliente.saldo < 0 && (
                  <span className="font-normal ml-1">(debe)</span>
                )}
                {cliente.saldo > 0 && (
                  <span className="font-normal ml-1">(a favor)</span>
                )}
              </span>
            </div>
            
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewCuenta(cliente)}
                className="flex-1 h-7 text-xs"
                data-testid={`view-cuenta-mobile-${cliente.id}`}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Cuenta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(cliente)}
                className="flex-1 h-7 text-xs"
                data-testid={`edit-cliente-mobile-${cliente.id}`}
              >
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive flex-1 h-7 text-xs"
                onClick={() => handleDelete(cliente.id)}
                data-testid={`delete-cliente-mobile-${cliente.id}`}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />

      {filteredClientes.length === 0 && (
        <Card className="py-6">
          <CardContent className="py-6 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
                 {searchTerm
                ? `No se encontraron clientes con "${searchTerm}"`
                : 'No hay clientes aún. Crea uno para empezar.'}
            </p>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="movimientos">
          {loadingMovimientos ? (
            <div className="text-center py-8">Cargando movimientos...</div>
          ) : filteredMovimientos.length === 0 ? (
            <Card className="py-6">
              <CardContent className="py-6 text-center">
                <CreditCard className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {movimientosTodos.length === 0 
                    ? 'No hay movimientos registrados' 
                    : 'No hay movimientos que coincidan con la búsqueda'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Todos los Movimientos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1 max-h-[60vh] overflow-y-auto px-4 pb-4">
                  {filteredMovimientos.map((mov) => {
                    const esVenta = mov.venta_id;
                    
                    return (
                      <div
                        key={mov.id}
                        className="flex justify-between items-center p-2 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          {esVenta ? (
                            <ShoppingCart className="w-3 h-3 text-primary" />
                          ) : mov.monto > 0 ? (
                            <TrendingUp className="w-3 h-3 text-green-600" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium text-xs">{mov.concepto}</p>
                            <p className="text-xs text-muted-foreground">
                              {mov.cliente_nombre} - {format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </p>
                            {mov.usuario_nombre && (
                              <p className="text-xs text-blue-600 font-medium">
                                Por: {mov.usuario_nombre}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-semibold ${
                            mov.monto > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {mov.monto > 0 ? '+' : ''}
                            {formatCurrency(mov.monto, showCents)}
                          </div>
                          <div className={`text-xs ${
                            mov.saldo_hasta_movimiento < 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            Saldo: {formatCurrency(mov.saldo_hasta_movimiento, showCents)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Cuenta Corriente */}
      <Dialog open={cuentaDialogOpen} onOpenChange={handleCuentaDialogClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Cuenta Corriente - {selectedCliente?.nombre}
            </DialogTitle>
          </DialogHeader>
          
          {loadingCuenta ? (
            <div className="text-center py-8">Cargando cuenta corriente...</div>
          ) : cuentaInfo ? (
            <div className="space-y-4">
              {/* Saldo Actual */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Saldo Actual</CardTitle>
                    <Dialog open={movimientoDialogOpen} onOpenChange={setMovimientoDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-7 text-xs">
                          <Plus className="w-3 h-3 mr-1" />
                          Nuevo Movimiento
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Registrar Movimiento</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleMovimientoSubmit} className="space-y-3">
                          <div>
                            <Label htmlFor="concepto" className="text-xs">Concepto</Label>
                            <Input
                              id="concepto"
                              value={movimientoData.concepto}
                              onChange={(e) => setMovimientoData({ ...movimientoData, concepto: e.target.value })}
                              required
                              placeholder="Ej: Pago, Abono"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label htmlFor="monto" className="text-xs">Monto (positivo para abono, negativo para cargo)</Label>
                            <Input
                              id="monto"
                              type="number"
                              step="0.01"
                              value={movimientoData.monto}
                              onChange={(e) => setMovimientoData({ ...movimientoData, monto: e.target.value })}
                              required
                              className="h-8"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button type="submit" className="flex-1 h-8">
                              Registrar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setMovimientoDialogOpen(false)}
                              className="h-8"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="py-3 pt-0">
                  <div className={`text-2xl font-bold ${
                    cuentaInfo.saldo < 0 ? 'text-destructive' : 'text-primary'
                  }`}>
                    {formatCurrency(Math.abs(cuentaInfo.saldo), showCents)}
                    {cuentaInfo.saldo < 0 && ' (debe)'}
                  </div>
                </CardContent>
              </Card>

              {/* Movimientos */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Movimientos</CardTitle>
                </CardHeader>
                <CardContent className="py-0">
                  {cuentaInfo.movimientos.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      No hay movimientos registrados
                    </p>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-1 max-h-[40vh] px-4 pb-4">
                       {cuentaInfo.movimientos.map((mov) => {
                          // Detectar si es una venta por el campo venta_id
                          const esVenta = mov.venta_id;
                          
                          return (
                          <div
                            key={mov.id}
                            className={`flex justify-between items-center p-2 bg-muted/50 rounded-md ${
                              esVenta ? 'cursor-pointer hover:bg-accent/50' : ''
                            }`}
                            onClick={() => esVenta && handleViewVenta(mov)}
                          >
                            <div className="flex items-center gap-2">
                              {esVenta ? (
                                <ShoppingCart className="w-3 h-3 text-primary" />
                              ) : mov.monto > 0 ? (
                                <TrendingUp className="w-3 h-3 text-green-600" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-red-600" />
                              )}
                              <div>
                                <p className="font-medium text-xs">{mov.concepto}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                                </p>
                                {mov.usuario_nombre && (
                                  <p className="text-xs text-blue-600 font-medium">
                                    Por: {mov.usuario_nombre}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`text-xs font-semibold ${
                                mov.monto > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {mov.monto > 0 ? '+' : ''}
                                {formatCurrency(mov.monto, showCents)}
                              </div>
                              {esVenta && (
                                <div className="w-3 h-3 rounded-full bg-primary/10 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                               </div>
                             )}
                           </div>
                         </div>
                         );
                       })}
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          ) : (
            <div className="text-center py-8">No se pudo cargar la cuenta corriente</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle de Venta */}
      <Dialog open={ventaDialogOpen} onOpenChange={handleVentaDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Detalle de Venta</DialogTitle>
            <DialogDescription>
              Información completa de la venta seleccionada
            </DialogDescription>
          </DialogHeader>
          {loadingVenta ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-8">Cargando detalles de la venta...</div>
            </div>
          ) : selectedVenta ? (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg flex-shrink-0">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha y Hora</p>
                  <p className="font-medium">
                    {format(new Date(selectedVenta.fecha), 'PPP HH:mm:ss', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuario</p>
                  <p className="font-medium">
                    {selectedVenta.usuario_nombre || 'Usuario desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Medio de Pago</p>
                  <p className="font-medium capitalize">
                    {selectedVenta.medio_pago?.replace('_', ' ') ?? '—'}
                  </p>
                </div>
                {selectedVenta.cliente_nombre && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedVenta.cliente_nombre}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <h3 className="font-semibold mb-3 flex-shrink-0">Productos</h3>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
                  {selectedVenta.detalles?.map((detalle, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-muted rounded-md"
                    >
                      <div>
                        <p className="font-medium">{capitalizeWords(detalle.producto_nombre)}</p>
                        <p className="text-sm text-muted-foreground">
                          {detalle.cantidad} x {formatCurrency(detalle.precio_unitario, showCents)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(detalle.subtotal, showCents)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg flex-shrink-0">
                <span className="text-xl font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(selectedVenta.total, showCents)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">No se pudo cargar la venta</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clientes;
