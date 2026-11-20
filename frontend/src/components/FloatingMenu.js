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

const DEFAULT_POS = { bottom: 20, right: 20 }; // pegado a la esquina, como el mockup
const BTN_SIZE = 56;
const MARGIN = 8;
const DRAG_THRESHOLD = 4;
const PANEL_OFFSET = 60; // alto del panel + puente de hover (versión anterior del menú)

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const getStorageKey = (userId) => `floatingMenuPosition_v2_${userId || 'anon'}`;
const getLegacyStorageKey = (userId) => `floatingMenuPosition_${userId || 'anon'}`;

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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const posRef = useRef(pos);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, pointerId: null });
  const containerRef = useRef(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // El panel se abre sólo al entrar al botón; un pequeño retardo al salir
  // permite cruzar el puente de hover hasta las opciones sin que se cierre.
  const openMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMenuOpen(true);
  };

  const closeMenuNow = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMenuOpen(false);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setMenuOpen(false), 120);
  };

  const anyModalOpen =
    productModalOpen ||
    customerModalOpen ||
    providerModalOpen ||
    egressModalOpen ||
    mercadopagoModalOpen ||
    chatIAModalOpen;

  // Si se abre cualquiera de los modales, el panel de acciones debe desaparecer
  // para no quedar superpuesto / "buggeado" detrás del dialog.
  useEffect(() => {
    if (anyModalOpen) closeMenuNow();
  }, [anyModalOpen]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const clampPos = (left, top) => {
    if (typeof window === 'undefined') return { left, top };
    // El panel es absoluto: el botón puede llegar hasta el borde superior.
    // Cuando está cerca de arriba el panel se abre hacia abajo (ver panelBelow).
    const minTop = MARGIN;
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
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.left === 'number' && typeof parsed.top === 'number') {
          return clampPos(parsed.left, parsed.top);
        }
      }
      // Migración: antes la posición guardada era del contenedor (panel + botón).
      // Ahora guardamos la posición del botón, así que compensamos ese offset.
      const legacyRaw = localStorage.getItem(getLegacyStorageKey(user?.id));
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed && typeof parsed.left === 'number' && typeof parsed.top === 'number') {
          const migrated = clampPos(parsed.left, parsed.top + PANEL_OFFSET);
          savePos(migrated);
          return migrated;
        }
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
      id: 'chatia',
      icon: Bot,
      label: 'Chat IA',
      modal: 'chatia',
      setOpen: setChatIAModalOpen,
    },
    {
      id: 'mercadopago',
      icon: MercadopagoIcon,
      label: 'Mercado Pago',
      modal: 'mercadopago',
      setOpen: setMercadopagoModalOpen,
    },
  ];

  const hiddenActions = Array.isArray(hiddenFloatingMenuActions) ? hiddenFloatingMenuActions : [];
  const quickActions = allQuickActions.filter((action) => !hiddenActions.includes(action.id));

  const containerStyle = pos
    ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' }
    : { right: DEFAULT_POS.right, bottom: DEFAULT_POS.bottom };

  // Cerca del borde superior no hay lugar para el panel arriba: lo abrimos abajo.
  const panelBelow = Boolean(pos && pos.top < 88);

  return (
    <>
      {/* Menú flotante comprimido (arrastrable, posición guardada por usuario) */}
      <div
        ref={containerRef}
        className="fixed z-50"
        style={containerStyle}
        onMouseLeave={scheduleClose}
      >
        {/* Panel en posición absoluta: cuando está cerrado no ocupa espacio ni
            intercepta el mouse (el contenedor mide sólo el botón). */}
        <div
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          className={`absolute right-0 transition-all duration-200 ${
            panelBelow ? 'top-full pt-3 origin-top-right' : 'bottom-full pb-3 origin-bottom-right'
          } ${
            menuOpen && !anyModalOpen
              ? 'opacity-100 visible translate-y-0 pointer-events-auto'
              : 'opacity-0 invisible translate-y-1 pointer-events-none'
          }`}
        >
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
              <Dialog
                key={action.modal}
                open={isOpen}
                onOpenChange={(next) => {
                  if (next) closeMenuNow();
                  action.setOpen(next);
                }}
              >
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

        {/* Botón principal (arrastrar para mover, doble clic para restablecer posición) */}
        <Button
          className="vpm-fab-button cursor-grab active:cursor-grabbing touch-none"
          title="Accesos rápidos (arrastrá para mover, doble clic para restablecer)"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onFocus={openMenu}
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Contenido de los modales */}
    </>
  );
};

export default FloatingMenu;