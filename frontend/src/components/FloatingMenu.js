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
import Clientes from '@/pages/Clientes';
import Proveedores from '@/pages/Proveedores';
import Egresos from '@/pages/Egresos';

const FloatingMenu = () => {
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [egressModalOpen, setEgressModalOpen] = useState(false);







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
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col">
                  <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {action.label}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {action.modal === 'product' && (
                      <div className="max-w-none">
                        <Productos />
                      </div>
                    )}
                    {action.modal === 'customer' && (
                      <div className="max-w-none">
                        <Clientes />
                      </div>
                    )}
                    {action.modal === 'provider' && (
                      <div className="max-w-none">
                        <Proveedores />
                      </div>
                    )}
                    {action.modal === 'egress' && (
                      <div className="max-w-none">
                        <Egresos />
                      </div>
                    )}
                  </div>
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









export default FloatingMenu;