import { useState } from 'react';
import { 
  Package, 
  Users, 
  Truck, 
  TrendingDown, 
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import Productos from '@/pages/Productos';
import Clientes from '@/pages/Clientes';
import Proveedores from '@/pages/Proveedores';
import Egresos from '@/pages/Egresos';
import Mercadopago from '@/pages/Mercadopago';
import MercadopagoIcon from '@/components/MercadopagoIcon';

const FloatingMenu = () => {
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [egressModalOpen, setEgressModalOpen] = useState(false);
  const [mercadopagoModalOpen, setMercadopagoModalOpen] = useState(false);

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
    {
      icon: MercadopagoIcon,
      label: 'Mercadopago',
      modal: 'mercadopago',
      setOpen: setMercadopagoModalOpen,
    },
  ];

  return (
    <>
      {/* Menú flotante comprimido */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="group flex flex-col items-center">
          {/* Panel que se expande al hacer hover */}
          <div className="opacity-0 invisible translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
            <div className="p-2 bg-card rounded-xl shadow-lg border border-border">
              <div className="flex flex-row items-center gap-1">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Dialog key={action.modal} open={action.modal === 'product' ? productModalOpen : 
                                                   action.modal === 'customer' ? customerModalOpen : 
                                                   action.modal === 'provider' ? providerModalOpen : 
                                                   action.modal === 'egress' ? egressModalOpen : 
                                                   mercadopagoModalOpen} onOpenChange={action.setOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-8 hover:bg-muted"
                    title={action.label}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className={action.modal === 'mercadopago' ? "max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col [&>button]:right-2 [&>button]:top-2" : "max-w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col"}>
                  <div className="flex-1 overflow-y-auto px-6 py-6">
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
                    {action.modal === 'mercadopago' && (
                      <div className="max-w-none">
                        <Mercadopago />
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
            </div>
          </div>
        </div>

        {/* Puente de hover que mantiene el menú expandido al mover el cursor */}
        <div className="h-3 w-16" />

        {/* Botón principal */}
        <Button
          className="h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 p-0"
          title="Accesos rápidos"
        >
          <Sparkles className="w-5 h-5" />
        </Button>
      </div>
    </div>

      {/* Contenido de los modales */}
    </>
  );
};

export default FloatingMenu;