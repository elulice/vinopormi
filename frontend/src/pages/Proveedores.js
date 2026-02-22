import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Truck, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { capitalizeWords } from '@/lib/utils';
import ResponsiveTable from '@/components/ResponsiveTable';
import { API } from '@/lib/config';
import SearchInput from '@/components/common/SearchInput';
import DeleteConfirmDialog from '@/components/common/DeleteConfirmDialog';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

  const handleDelete = (id) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await axios.delete(`${API}/proveedores/${deletingId}`, {
        headers: getAuthHeader()
      });
      toast.success('Proveedor eliminado');
      fetchProveedores();
    } catch (error) {
      toast.error('Error al eliminar proveedor');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
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
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus proveedores y sus cuentas corrientes</p>
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
            <Button size="sm" className="h-7 text-xs" onClick={() => resetForm()}>
              <Plus className="w-3 h-3 mr-1" />
              Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </DialogTitle>
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
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="telefono" className="text-xs">Teléfono (opcional)</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="h-8"
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
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="direccion" className="text-xs">Dirección (opcional)</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor="cuit" className="text-xs">CUIT (opcional)</Label>
                <Input
                  id="cuit"
                  value={formData.cuit}
                  onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 h-8">
                  {editingProveedor ? 'Actualizar' : 'Crear'}
                </Button>
                <Button type="button" variant="outline" onClick={handleDialogClose} className="h-8">
                  Cancelar
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Eliminar proveedor"
        description="¿Estás seguro de eliminar este proveedor? Esta acción no se puede deshacer."
      />
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
          <tr key={proveedor.id} className="border-b">
            <td className="p-2">
              <div className="flex items-center gap-2 text-sm">
                <Truck className="w-3 h-3 text-secondary" />
                <div>
                  <span className="truncate">{proveedor.nombre}</span>
                  {proveedor.cuit && (
                    <p className="text-xs text-muted-foreground">CUIT: {proveedor.cuit}</p>
                  )}
                </div>
              </div>
            </td>
            <td className="p-2">
              <div className="text-xs">
                {proveedor.telefono && <p>{proveedor.telefono}</p>}
                {proveedor.email && <p className="text-muted-foreground">{proveedor.email}</p>}
                {proveedor.direccion && <p className="text-muted-foreground truncate">{proveedor.direccion}</p>}
              </div>
            </td>
            <td className="p-2">
              <div className={`text-sm font-semibold ${
                proveedor.saldo < 0 ? 'text-destructive' : 'text-green-600'
              }`}>
                {formatCurrency(Math.abs(proveedor.saldo || 0), showCents)}
                {proveedor.saldo < 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">(adeuda)</span>
                )}
                {proveedor.saldo > 0 && (
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
                  onClick={() => handleViewCuenta(proveedor)}
                >
                  <CreditCard className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1"
                  onClick={() => handleEdit(proveedor)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1 text-destructive"
                  onClick={() => handleDelete(proveedor.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </td>
          </tr>
        )}
        renderMobileCard={(proveedor, index) => (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-secondary/10 rounded flex items-center justify-center">
                <Truck className="w-4 h-4 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm truncate">{proveedor.nombre}</h3>
                {proveedor.cuit && (
                  <p className="text-xs text-muted-foreground">CUIT: {proveedor.cuit}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <div>
                {proveedor.telefono && <span>{proveedor.telefono}</span>}
                {proveedor.email && <span className="ml-2">{proveedor.email}</span>}
              </div>
              <div className={`font-semibold ${
                proveedor.saldo < 0 ? 'text-destructive' : 'text-green-600'
              }`}>
                {formatCurrency(Math.abs(proveedor.saldo || 0), showCents)}
                {proveedor.saldo < 0 && (
                  <span className="font-normal ml-1">(adeuda)</span>
                )}
                {proveedor.saldo > 0 && (
                  <span className="font-normal ml-1">(a favor)</span>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewCuenta(proveedor)}
                className="flex-1 h-7 text-xs"
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Cuenta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(proveedor)}
                className="flex-1 h-7 text-xs"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive flex-1 h-7 text-xs"
                onClick={() => handleDelete(proveedor.id)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      />

      {filteredProveedores.length === 0 && (
        <Card className="py-6">
          <CardContent className="py-6 text-center">
            <Truck className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
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
              <CreditCard className="w-4 h-4" />
              Cuenta Corriente - {selectedProveedor?.nombre}
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
                              placeholder="Ej: Pago, Compra"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label htmlFor="monto" className="text-xs">Monto (positivo para pago, negativo para deuda)</Label>
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
                <CardContent className="py-2">
                  <div className={`text-2xl font-bold ${
                    cuentaInfo.saldo < 0 ? 'text-destructive' : 'text-primary'
                  }`}>
                    {formatCurrency(Math.abs(cuentaInfo.saldo), showCents)}
                    {cuentaInfo.saldo < 0 && ' (adeuda)'}
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
                       {cuentaInfo.movimientos.map((mov) => (
                         <div
                           key={mov.id}
                           className="flex justify-between items-center p-2 bg-muted/50 rounded-md"
                         >
                           <div className="flex items-center gap-2">
                             {mov.monto > 0 ? (
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
                           <div className={`text-xs font-semibold ${
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