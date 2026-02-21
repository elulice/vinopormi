import { useState, useRef, useEffect } from 'react';
import { 
  Package, 
  Users, 
  Truck, 
  TrendingDown,
  GripVertical
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

  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const rect = menuRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newX = window.innerWidth - e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      const maxX = window.innerWidth - 60 - 16;
      const maxY = window.innerHeight - 200 - 16;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

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
      <div 
        ref={menuRef}
        className={`fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ 
          right: position.x, 
          top: position.y,
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-center pb-1 border-b mb-1">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
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
                    className="p-1 h-6 hover:bg-gray-100"
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