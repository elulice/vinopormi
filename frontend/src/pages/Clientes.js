import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Users, CreditCard, TrendingUp, TrendingDown, ShoppingCart, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { capitalizeWords } from '@/lib/utils';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import SearchInput from '@/components/common/SearchInput';
import DeleteConfirmDialog from '@/components/common/DeleteConfirmDialog';

const Clientes = () => {
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
    apellido: '',
    dni: '',
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchClientes = useCallback(async () => {
    try {
      const response = await apiGet(`${API}/clientes`);
      setClientes(response.data);
    } catch (error) {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMovimientosTodos = useCallback(async () => {
    setLoadingMovimientos(true);
    try {
      const response = await apiGet(`${API}/movimientos-todos`);
      setMovimientosTodos(response.data);
    } catch (error) {
      toast.error('Error al cargar movimientos');
    } finally {
      setLoadingMovimientos(false);
    }
  }, []);

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
      apellido: formData.apellido || null,
      dni: formData.dni || null,
      telefono: formData.telefono || null,
      email: formData.email || null
    };

    try {
      if (editingCliente) {
        await apiPut(`${API}/clientes/${editingCliente.id}`, data);
        toast.success('Cliente actualizado');
      } else {
        await apiPost(`${API}/clientes`, data);
        toast.success('Cliente creado');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchClientes();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al guardar cliente';
      if (errorMsg.includes('DNI')) {
        toast.error('Ya existe un cliente con ese DNI');
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nombre: cliente.nombre,
      apellido: cliente.apellido || '',
      dni: cliente.dni || '',
      telefono: cliente.telefono || '',
      email: cliente.email || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await apiDelete(`${API}/clientes/${deletingId}`);
      toast.success('Cliente eliminado');
      fetchClientes();
    } catch (error) {
      toast.error('Error al eliminar cliente');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', apellido: '', dni: '', telefono: '', email: '' });
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
      const response = await apiGet(
        `${API}/clientes/${cliente.id}/cuenta-corriente`
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
    formData.apellido !== (editingCliente.apellido || '') ||
    formData.dni !== (editingCliente.dni || '') ||
    formData.telefono !== (editingCliente.telefono || '') ||
    formData.email !== (editingCliente.email || '')
  );

  const handleMovimientoSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await apiPost(
        `${API}/clientes/${selectedCliente.id}/movimientos?concepto=${encodeURIComponent(movimientoData.concepto)}&monto=${parseFloat(movimientoData.monto)}`,
        {}
      );
      
      toast.success('Movimiento registrado');
      setMovimientoDialogOpen(false);
      setMovimientoData({ concepto: '', monto: '' });
      
      // Recargar cuenta corriente
      const response = await apiGet(
        `${API}/clientes/${selectedCliente.id}/cuenta-corriente`
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
      const response = await apiGet(`${API}/ventas/${ventaId}`);
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
        <SearchInput
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          onClear={() => setSearchTerm('')}
        />

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
                <Label htmlFor="nombre" className="text-xs">Nombre *</Label>
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
                <Label htmlFor="apellido" className="text-xs">Apellido (opcional)</Label>
                <Input
                  id="apellido"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  className="h-8"
                  data-testid="cliente-apellido-input"
                />
              </div>
              <div>
                <Label htmlFor="dni" className="text-xs">DNI (para acceso web) *</Label>
                <Input
                  id="dni"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  required
                  className="h-8"
                  placeholder="12345678"
                  data-testid="cliente-dni-input"
                />
                <p className="text-[10px] text-muted-foreground mt-1">DNI es requerido para acceso de miembros</p>
              </div>
              <div>
                <Label htmlFor="telefono" className="text-xs">Teléfono (opcional)</Label>
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
          { title: 'Cliente', width: '30%' },
          { title: 'DNI', width: '15%' },
          { title: 'Puntos', width: '10%' },
          { title: 'Saldo', width: '25%' },
          { title: 'Acciones', width: '20%' }
        ]}
        rows={filteredClientes}
        renderDesktopRow={(cliente, index) => (
          <tr key={cliente.id} className="border-b" data-testid={`cliente-card-${cliente.id}`}>
            <td className="p-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-3 h-3 text-secondary" />
                <div>
                  <span className="truncate block">{cliente.nombre}</span>
                  {cliente.apellido && (
                    <span className="text-xs text-muted-foreground truncate block">{cliente.apellido}</span>
                  )}
                </div>
              </div>
            </td>
            <td className="p-2">
              <span className="text-sm font-mono">{cliente.dni || '—'}</span>
            </td>
            <td className="p-2">
              <span className="text-sm font-semibold text-primary">{cliente.puntos || 0}</span>
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
                <h3 className="font-medium text-sm truncate">{cliente.nombre} {cliente.apellido}</h3>
                {cliente.dni && (
                  <p className="text-xs text-muted-foreground">DNI: {cliente.dni}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-primary">{cliente.puntos || 0} pts</span>
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
                            className={`grid grid-cols-12 gap-2 items-center p-2 bg-muted/50 rounded-md ${
                              esVenta ? 'cursor-pointer hover:bg-accent/50' : ''
                            }`}
                            onClick={() => esVenta && handleViewVenta(mov)}
                          >
                            <div className="col-span-6 flex items-center gap-2">
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
                            <div className="col-span-3 text-right">
                              <div className={`text-xs font-semibold ${
                                mov.monto > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {mov.monto > 0 ? '+' : ''}
                                {formatCurrency(mov.monto, showCents)}
                              </div>
                            </div>
                            <div className="col-span-3 text-right">
                              <div className={`text-xs px-1.5 py-0.5 rounded inline-block ${
                                mov.saldo_hasta_movimiento < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {formatCurrency(mov.saldo_hasta_movimiento, showCents)}
                              </div>
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
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base">Detalle de Venta</DialogTitle>
          </DialogHeader>
          {loadingVenta ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-8">Cargando detalles de la venta...</div>
            </div>
          ) : selectedVenta ? (
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
              <div className="grid grid-cols-2 gap-2 p-2 bg-muted rounded-md flex-shrink-0 text-xs">
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium text-xs">
                    {format(new Date(selectedVenta.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Usuario</p>
                  <p className="font-medium text-xs">
                    {selectedVenta.usuario_nombre || 'Usuario desconocido'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Medio de Pago</p>
                  <p className="font-medium capitalize text-xs">
                    {selectedVenta.medio_pago?.replace('_', ' ') ?? '—'}
                  </p>
                </div>
                {selectedVenta.cliente_nombre && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-medium text-xs">{selectedVenta.cliente_nombre}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <h3 className="font-semibold text-sm py-1 flex-shrink-0">Productos</h3>
                <div className="flex-1 overflow-y-auto space-y-1 max-h-[40vh]">
                  {selectedVenta.detalles?.map((detalle, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-muted rounded-md text-xs"
                    >
                      <div>
                        <p className="font-medium text-xs">{capitalizeWords(detalle.producto_nombre)}</p>
                        <p className="text-muted-foreground text-xs">
                          {detalle.cantidad} x {formatCurrency(detalle.precio_unitario, showCents)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-xs">
                          {formatCurrency(detalle.subtotal, showCents)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center p-2 bg-primary/10 rounded-md flex-shrink-0">
                <span className="font-bold text-sm">Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(selectedVenta.total, showCents)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">No se pudo cargar la venta</div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Eliminar cliente"
        description="¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer."
      />
    </div>
  );
};

export default Clientes;
