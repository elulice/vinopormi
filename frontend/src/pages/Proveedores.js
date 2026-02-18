import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Building, CreditCard, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { capitalizeWords } from '@/lib/utils';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';

const Proveedores = () => {
  const { getAuthHeader } = useAuth();
  const { showCents } = useConfig();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false);
  const [movimientoDialogOpen, setMovimientoDialogOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [cuentaInfo, setCuentaInfo] = useState(null);
  const [loadingCuenta, setLoadingCuenta] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    cuit: ''
  });
  const [movimientoData, setMovimientoData] = useState({
    concepto: '',
    monto: ''
  });

  const fetchProveedores = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/proveedores`, {
        headers: getAuthHeader()
      });
      setProveedores(response.data);
    } catch (error) {
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      nombre: formData.nombre,
      telefono: formData.telefono,
      email: formData.email || null,
      direccion: formData.direccion || null,
      cuit: formData.cuit || null
    };

    try {
      if (editingProveedor) {
        await axios.put(`${API}/proveedores/${editingProveedor.id}`, data, {
          headers: getAuthHeader()
        });
        toast.success('Proveedor actualizado');
      } else {
        await axios.post(`${API}/proveedores`, data, {
          headers: getAuthHeader()
        });
        toast.success('Proveedor creado');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchProveedores();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar proveedor');
    }
  };

  const handleEdit = (proveedor) => {
    setEditingProveedor(proveedor);
    setFormData({
      nombre: proveedor.nombre,
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      cuit: proveedor.cuit || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este proveedor?')) return;
    
    try {
      await axios.delete(`${API}/proveedores/${id}`, {
        headers: getAuthHeader()
      });
      toast.success('Proveedor eliminado');
      fetchProveedores();
    } catch (error) {
      toast.error('Error al eliminar proveedor');
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', telefono: '', email: '', direccion: '', cuit: '' });
    setEditingProveedor(null);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleViewCuenta = async (proveedor) => {
    setSelectedProveedor(proveedor);
    setCuentaDialogOpen(true);
    setLoadingCuenta(true);
    
    try {
      const response = await axios.get(
        `${API}/proveedores/${proveedor.id}/cuenta-corriente`,
        { headers: getAuthHeader() }
      );
      setCuentaInfo(response.data);
    } catch (error) {
      toast.error('Error al cargar cuenta corriente');
    } finally {
      setLoadingCuenta(false);
    }
  };

  const handleMovimientoSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(
        `${API}/proveedores/${selectedProveedor.id}/movimientos?concepto=${encodeURIComponent(movimientoData.concepto)}&monto=${parseFloat(movimientoData.monto)}`,
        {},
        { headers: getAuthHeader() }
      );
      
      toast.success('Movimiento registrado');
      setMovimientoDialogOpen(false);
      setMovimientoData({ concepto: '', monto: '' });
      
      // Recargar cuenta corriente
      const response = await axios.get(
        `${API}/proveedores/${selectedProveedor.id}/cuenta-corriente`,
        { headers: getAuthHeader() }
      );
      setCuentaInfo(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar movimiento');
    }
  };

  const handleCuentaDialogClose = () => {
    setCuentaDialogOpen(false);
    setSelectedProveedor(null);
    setCuentaInfo(null);
  };

  const filteredProveedores = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.telefono && p.telefono.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.cuit && p.cuit.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Proveedores</h1>
          <p className="text-muted-foreground">Gestiona tus proveedores y sus cuentas corrientes</p>
        </div>
      </div>

      {/* BUSCADOR + BOTÓN AGREGAR */}
      <div className="flex gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </DialogTitle>
              <DialogDescription>
                {editingProveedor ? 'Modifica los datos del proveedor seleccionado' : 'Completa los datos para crear un nuevo proveedor'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  value={formData.cuit}
                  onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingProveedor ? 'Actualizar' : 'Crear'}
                </Button>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ResponsiveTable
        headers={[
          { title: 'Proveedor', width: '40%' },
          { title: 'Contacto', width: '35%' },
          { title: 'Saldo', width: '15%' },
          { title: 'Acciones', width: '10%' }
        ]}
        rows={filteredProveedores}
        renderDesktopRow={(proveedor, index) => (
          <tr key={proveedor.id} className="border-b hover:bg-accent/50 transition-colors">
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Building className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <span className="font-medium">{proveedor.nombre}</span>
                  {proveedor.cuit && (
                    <p className="text-sm text-muted-foreground">CUIT: {proveedor.cuit}</p>
                  )}
                </div>
              </div>
            </td>
            <td className="p-4">
              <div className="text-sm">
                {proveedor.telefono && <p>{proveedor.telefono}</p>}
                {proveedor.email && <p className="text-muted-foreground">{proveedor.email}</p>}
                {proveedor.direccion && <p className="text-muted-foreground">{proveedor.direccion}</p>}
              </div>
            </td>
            <td className="p-4">
              <div className={`text-lg font-semibold ${
                proveedor.saldo < 0 ? 'text-destructive' : 'text-green-600'
              }`}>
                {formatCurrency(Math.abs(proveedor.saldo || 0), showCents)}
                {proveedor.saldo < 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">(adeuda)</span>
                )}
                {proveedor.saldo > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">(a favor)</span>
                )}
              </div>
            </td>
            <td className="p-4">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewCuenta(proveedor)}
                >
                  <CreditCard className="w-4 h-4 mr-1" />
                  Cuenta
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(proveedor)}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(proveedor.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(proveedor, index) => (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{proveedor.nombre}</h3>
                {proveedor.cuit && (
                  <p className="text-sm text-muted-foreground">CUIT: {proveedor.cuit}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2 mb-4 text-sm">
              {proveedor.telefono && (
                <div>
                  <span className="text-muted-foreground">Teléfono: </span>
                  <span>{proveedor.telefono}</span>
                </div>
              )}
              {proveedor.email && (
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span>{proveedor.email}</span>
                </div>
              )}
              {proveedor.direccion && (
                <div>
                  <span className="text-muted-foreground">Dirección: </span>
                  <span>{proveedor.direccion}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Saldo: </span>
                <span className={`font-semibold text-lg ${
                  proveedor.saldo < 0 ? 'text-destructive' : 'text-green-600'
                }`}>
                  {formatCurrency(Math.abs(proveedor.saldo || 0), showCents)}
                  {proveedor.saldo < 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">(adeuda)</span>
                  )}
                  {proveedor.saldo > 0 && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">(a favor)</span>
                  )}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewCuenta(proveedor)}
                className="flex-1"
              >
                <CreditCard className="w-4 h-4 mr-1" />
                Cuenta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(proveedor)}
                className="flex-1"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive flex-1"
                onClick={() => handleDelete(proveedor.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />

      {filteredProveedores.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm
                ? `No se encontraron proveedores con "${searchTerm}"`
                : 'No hay proveedores aún. Crea uno para empezar.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de Cuenta Corriente */}
      <Dialog open={cuentaDialogOpen} onOpenChange={handleCuentaDialogClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Cuenta Corriente - {selectedProveedor?.nombre}
            </DialogTitle>
            <DialogDescription>
              Gestiona los movimientos y saldo de la cuenta corriente del proveedor
            </DialogDescription>
          </DialogHeader>
          
          {loadingCuenta ? (
            <div className="text-center py-8">Cargando cuenta corriente...</div>
          ) : cuentaInfo ? (
            <div className="space-y-6">
              {/* Saldo Actual */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Saldo Actual</CardTitle>
                    <Dialog open={movimientoDialogOpen} onOpenChange={setMovimientoDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Nuevo Movimiento
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Registrar Movimiento</DialogTitle>
                          <DialogDescription>
                            Registra un nuevo movimiento en la cuenta corriente del proveedor
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleMovimientoSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="concepto">Concepto</Label>
                            <Input
                              id="concepto"
                              value={movimientoData.concepto}
                              onChange={(e) => setMovimientoData({ ...movimientoData, concepto: e.target.value })}
                              required
                              placeholder="Ej: Pago, Compra"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="monto">Monto (positivo para pago, negativo para deuda)</Label>
                            <Input
                              id="monto"
                              type="number"
                              step="0.01"
                              value={movimientoData.monto}
                              onChange={(e) => setMovimientoData({ ...movimientoData, monto: e.target.value })}
                              required
                            />
                          </div>
                          <div className="flex gap-2 pt-4">
                            <Button type="submit" className="flex-1">
                              Registrar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setMovimientoDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${
                    cuentaInfo.saldo < 0 ? 'text-destructive' : 'text-primary'
                  }`}>
                    {formatCurrency(Math.abs(cuentaInfo.saldo), showCents)}
                    {cuentaInfo.saldo < 0 && ' (adeuda)'}
                  </div>
                </CardContent>
              </Card>

              {/* Movimientos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Movimientos</CardTitle>
                </CardHeader>
                <CardContent>
                  {cuentaInfo.movimientos.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay movimientos registrados
                    </p>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
                       {cuentaInfo.movimientos.map((mov) => (
                         <div
                           key={mov.id}
                           className="flex justify-between items-center p-3 bg-muted rounded-md"
                         >
                           <div className="flex items-center gap-3">
                             {mov.monto > 0 ? (
                               <TrendingUp className="w-4 h-4 text-green-600" />
                             ) : (
                               <TrendingDown className="w-4 h-4 text-red-600" />
                             )}
                             <div>
                               <p className="font-medium text-sm">{mov.concepto}</p>
                               <p className="text-xs text-muted-foreground">
                                 {format(new Date(mov.fecha), 'PPP HH:mm', { locale: es })}
                               </p>
                               {mov.usuario_nombre && (
                                 <p className="text-xs text-blue-600 font-medium">
                                   Por: {mov.usuario_nombre}
                                 </p>
                               )}
                             </div>
                           </div>
                           <div className={`text-sm font-semibold ${
                             mov.monto > 0 ? 'text-green-600' : 'text-red-600'
                           }`}>
                             {mov.monto > 0 ? '+' : ''}
                             {formatCurrency(mov.monto, showCents)}
                           </div>
                         </div>
                       ))}
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
    </div>
  );
};

export default Proveedores;