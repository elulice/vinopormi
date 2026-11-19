import { useEffect, useRef, useState } from 'react';
import { 
  Package, 
  Users, 
  Truck, 
  TrendingDown, 
  Menu,
  Bot
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
import ChatIA from '@/pages/ChatIA';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';

const DEFAULT_POS = { bottom: 112, right: 16 }; // bottom-28, right-4
const BTN_SIZE = 56;
const MARGIN = 8;
const DRAG_THRESHOLD = 4;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const getStorageKey = (userId) => `floatingMenuPosition_${userId || 'anon'}`;

const FloatingMenu = () => {
  const { user } = useAuth();
  const { hiddenFloatingMenuActions } = useConfig();
  const storageKey = getStorageKey(user?.id);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [egressModalOpen, setEgressModalOpen] = useState(false);
  const [mercadopagoModalOpen, setMercadopagoModalOpen] = useState(false);
  const [chatIAModalOpen, setChatIAModalOpen] = useState(false);

  const [pos, setPos] = useState(null); // {left, top} or null for default
  const posRef = useRef(pos);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, pointerId: null });
  const containerRef = useRef(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const clampPos = (left, top) => {
    if (typeof window === 'undefined') return { left, top };
    const panelReserve = 80; // espacio para que el panel hover hacia arriba sea visible
    const minTop = MARGIN + panelReserve;
    const maxLeft = Math.max(MARGIN, window.innerWidth - BTN_SIZE - MARGIN);
    const maxTop = Math.max(minTop, window.innerHeight - BTN_SIZE - MARGIN);
    return {
      left: clamp(left, MARGIN, maxLeft),
      top: clamp(top, minTop, maxTop),
    };
  };

  const loadPos = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.left === 'number' && typeof parsed.top === 'number') {
        return clampPos(parsed.left, parsed.top);
      }
    } catch {}
    return null;
  };

  // Load position per user and re-clamp on resize
  useEffect(() => {
    setPos(loadPos());
    const onResize = () => {
      setPos((prev) => (prev ? clampPos(prev.left, prev.top) : prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const savePos = (next) => {
    try {
      if (next) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch {}
  };

  const resetPosition = () => {
    setPos(null);
    savePos(null);
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      pointerId: e.pointerId,
    };
  };

  useEffect(() => {
    const handleMove = (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        d.moved = true;
        try {
          if (d.pointerId != null) e.target?.setPointerCapture?.(d.pointerId);
        } catch {}
      }
      const next = clampPos(e.clientX - d.offsetX, e.clientY - d.offsetY);
      setPos(next);
      posRef.current = next;
    };

    const handleUp = (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      if (d.moved && posRef.current) {
        savePos(posRef.current);
      }
      dragRef.current = { active: false, moved: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, pointerId: null };
      try {
        if (d.pointerId != null) e.target?.releasePointerCapture?.(d.pointerId);
      } catch {}
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const allQuickActions = [
    {
      id: 'product',
      icon: Package,
      label: 'Productos',
      modal: 'product',
      setOpen: setProductModalOpen,
    },
    {
      id: 'customer',
      icon: Users,
      label: 'Ctas. Ctes.',
      modal: 'customer',
      setOpen: setCustomerModalOpen,
    },
    {
      id: 'provider',
      icon: Truck,
      label: 'Proveedores',
      modal: 'provider',
      setOpen: setProviderModalOpen,
    },
    {
      id: 'egress',
      icon: TrendingDown,
      label: 'Egresos',
      modal: 'egress',
      setOpen: setEgressModalOpen,
    },
    {
      id: 'mercadopago',
      icon: MercadopagoIcon,
      label: 'Mercado Pago',
      modal: 'mercadopago',
      setOpen: setMercadopagoModalOpen,
    },
    {
      id: 'chatia',
      icon: Bot,
      label: 'Chat IA',
      modal: 'chatia',
      setOpen: setChatIAModalOpen,
    },
  ];

  const hiddenActions = Array.isArray(hiddenFloatingMenuActions) ? hiddenFloatingMenuActions : [];
  const quickActions = allQuickActions.filter((action) => !hiddenActions.includes(action.id));

  const containerStyle = pos
    ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' }
    : { right: DEFAULT_POS.right, bottom: DEFAULT_POS.bottom };

  return (
    <>
      {/* Menú flotante comprimido (arrastrable, posición guardada por usuario) */}
      <div ref={containerRef} className="fixed z-50" style={containerStyle}>
        <div className="group flex flex-col items-center">
          {/* Panel que se expande al hacer hover */}
          <div className="opacity-0 invisible translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
            <div className="vpm-fab-panel">
              <div className="flex flex-row items-center gap-1">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const isOpen =
              action.modal === 'product' ? productModalOpen :
              action.modal === 'customer' ? customerModalOpen :
              action.modal === 'provider' ? providerModalOpen :
              action.modal === 'egress' ? egressModalOpen :
              action.modal === 'mercadopago' ? mercadopagoModalOpen :
              chatIAModalOpen;
            return (
              <Dialog key={action.modal} open={isOpen} onOpenChange={action.setOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="vpm-fab-action"
                    title={action.label}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className={
                  action.modal === 'mercadopago'
                    ? "max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col [&>button]:right-2 [&>button]:top-2"
                    : action.modal === 'chatia'
                    ? "max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button]:right-2 [&>button]:top-2"
                    : "max-w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col"
                }>
                  <div className={`flex-1 overflow-y-auto ${action.modal === 'chatia' ? 'p-3' : 'px-6 py-6'}`}>
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
                    {action.modal === 'chatia' && (
                      <div className="max-w-none h-full">
                        <ChatIA />
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

        {/* Botón principal (arrastrar para mover, doble clic para restablecer posición) */}
        <Button
          className="vpm-fab-button cursor-grab active:cursor-grabbing touch-none"
          title="Accesos rápidos (arrastrá para mover, doble clic para restablecer)"
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    </div>

      {/* Contenido de los modales */}
    </>
  );
};

export default FloatingMenu;