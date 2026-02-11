import { useState } from 'react';
import { 
  Package, 
  Users, 
  Truck, 
  TrendingDown,
  Plus,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Productos from '@/pages/Productos';

const FloatingMenu = () => {
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [egressModalOpen, setEgressModalOpen] = useState(false);



  const sampleCustomers = [
    { id: 1, name: 'Juan Pérez', email: 'juan@email.com', phone: '11-1234-5678' },
    { id: 2, name: 'María García', email: 'maria@email.com', phone: '11-2345-6789' },
    { id: 3, name: 'Carlos López', email: 'carlos@email.com', phone: '11-3456-7890' },
  ];

  const sampleProviders = [
    { id: 1, name: 'Bodega Argentina', email: 'contacto@bodega.com', phone: '11-4567-8901' },
    { id: 2, name: 'Vinos del Sur', email: 'info@vinos.com', phone: '11-5678-9012' },
    { id: 3, name: 'Importadora Wine', email: 'import@wine.com', phone: '11-6789-0123' },
  ];

  const quickActions = [
    {
      icon: Package,
      label: 'Productos',
      modal: 'product',
      setOpen: setProductModalOpen,
    },
    {
      icon: Users,
      label: 'Ctas. Ctes.',
      modal: 'customer',
      setOpen: setCustomerModalOpen,
    },
    {
      icon: Truck,
      label: 'Proveedores',
      modal: 'provider',
      setOpen: setProviderModalOpen,
    },
    {
      icon: TrendingDown,
      label: 'Egresos',
      modal: 'egress',
      setOpen: setEgressModalOpen,
    },
  ];

  return (
    <>
      {/* Menú flotante */}
      <div className="fixed top-[4.5rem] right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 lg:top-4 lg:right-4">
        <div className="flex flex-row gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Dialog key={action.modal} open={action.modal === 'product' ? productModalOpen : 
                                                   action.modal === 'customer' ? customerModalOpen : 
                                                   action.modal === 'provider' ? providerModalOpen : 
                                                   egressModalOpen} onOpenChange={action.setOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 hover:bg-gray-100"
                    title={action.label}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {action.label}
                    </DialogTitle>
                  </DialogHeader>
                  {action.modal === 'product' && (
                    <div className="max-w-none">
                      <Productos />
                    </div>
                  )}
                  {action.modal === 'customer' && (
                    <CustomerModalContent 
                      customers={sampleCustomers} 
                      onClose={() => setCustomerModalOpen(false)} 
                    />
                  )}
                  {action.modal === 'provider' && (
                    <ProviderModalContent 
                      providers={sampleProviders} 
                      onClose={() => setProviderModalOpen(false)} 
                    />
                  )}
                  {action.modal === 'egress' && (
                    <EgressModalContent 
                      onClose={() => setEgressModalOpen(false)} 
                    />
                  )}
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </div>

      {/* Contenido de los modales */}
    </>
  );
};



// Componente de contenido para clientes
const CustomerModalContent = ({ customers, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isNewCustomer) {
    return <NewCustomerForm onClose={() => setIsNewCustomer(false)} />;
  }

  if (editingCustomer) {
    return <EditCustomerForm customer={editingCustomer} onClose={() => setEditingCustomer(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <Button onClick={() => setIsNewCustomer(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva Cta. Cte.
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCustomers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.name}</TableCell>
              <TableCell>{customer.email}</TableCell>
              <TableCell>{customer.phone}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingCustomer(customer)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// Formulario de nuevo cliente
const NewCustomerForm = ({ onClose }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Nueva Cta. Cte.</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <Input placeholder="Nombre del cliente" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" placeholder="Email del cliente" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <Input placeholder="Teléfono del cliente" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button>Guardar Cta. Cte.</Button>
      </div>
    </div>
  );
};

// Formulario de editar cliente
const EditCustomerForm = ({ customer, onClose }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Editar Cta. Cte.</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <Input defaultValue={customer.name} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" defaultValue={customer.email} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <Input defaultValue={customer.phone} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button>Guardar Cambios</Button>
      </div>
    </div>
  );
};

// Componente de contenido para proveedores
const ProviderModalContent = ({ providers, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewProvider, setIsNewProvider] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);

  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isNewProvider) {
    return <NewProviderForm onClose={() => setIsNewProvider(false)} />;
  }

  if (editingProvider) {
    return <EditProviderForm provider={editingProvider} onClose={() => setEditingProvider(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <Button onClick={() => setIsNewProvider(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Proveedor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProviders.map((provider) => (
            <TableRow key={provider.id}>
              <TableCell className="font-medium">{provider.name}</TableCell>
              <TableCell>{provider.email}</TableCell>
              <TableCell>{provider.phone}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProvider(provider)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// Formulario de nuevo proveedor
const NewProviderForm = ({ onClose }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Nuevo Proveedor</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <Input placeholder="Nombre del proveedor" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" placeholder="Email del proveedor" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <Input placeholder="Teléfono del proveedor" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button>Guardar Proveedor</Button>
      </div>
    </div>
  );
};

// Formulario de editar proveedor
const EditProviderForm = ({ provider, onClose }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Editar Proveedor</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <Input defaultValue={provider.name} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input type="email" defaultValue={provider.email} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <Input defaultValue={provider.phone} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button>Guardar Cambios</Button>
      </div>
    </div>
  );
};

// Componente de contenido para egresos
const EgressModalContent = ({ onClose }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
  });

  const categories = [
    'Alquiler',
    'Servicios',
    'Insumos',
    'Personal',
    'Mantenimiento',
    'Otros'
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Nuevo Egreso</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <Input 
            placeholder="Descripción del egreso"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Monto</label>
          <Input 
            type="number" 
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <select 
            className="w-full p-2 border border-gray-300 rounded-md"
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
          >
            <option value="">Seleccionar categoría</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <Input 
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button>Guardar Egreso</Button>
      </div>
    </div>
  );
};

export default FloatingMenu;