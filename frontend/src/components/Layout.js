import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import FloatingMenu from '@/components/FloatingMenu';
import Skeleton from '@/components/Skeleton';
import { 
  LayoutDashboard, 
  Plus, 
  ShoppingCart, 
  Package, 
  Users, 
  Truck, 
  TrendingDown,
  Settings as SettingsIcon,
  LogIn,
  History,
  Shield,
  Wrench,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Moon,
  Bot,
  Sparkles,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FEATURES } from '@/lib/config';
import { fetchDashboardStats } from '@/lib/dashboardStats';
import { connectDataEvents, useDataRefresh } from '@/lib/dataEvents';
import { logoImage } from '@/assets/images';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import BackgroundSync from '@/components/BackgroundSync';
import WelcomeModal from '@/components/WelcomeModal';
import '@/components/DashboardV4.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const { sidebarWidth, setSidebarWidth, floatingMenu, darkMode, setDarkMode, hiddenSidebarItems, soloMisDatos } = useConfig();
  // Sólo dos tamaños: compacto y grande. Cualquier valor viejo ("normal") se trata como grande.
  const isCompact = sidebarWidth === 'compact';
  const location = useLocation();
  const navigate = useNavigate();
  const [debtCount, setDebtCount] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [configMenuPos, setConfigMenuPos] = useState(null);
  const configTriggerRef = useRef(null);
  const configPopRef = useRef(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSidebarVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Badge del sidebar: cantidad real de clientes en cuenta corriente.
  const fetchDebtCount = useCallback(async () => {
    try {
      const stats = await fetchDashboardStats({ soloMisDatos });
      setDebtCount(stats?.ultimos_clientes_cta_cte?.length || 0);
    } catch {
      setDebtCount(0);
    }
  }, [soloMisDatos]);

  useEffect(() => {
    fetchDebtCount();
  }, [fetchDebtCount]);
  useDataRefresh(['dashboard'], fetchDebtCount);

  // Unico canal SSE para toda la app: el bus avisa a las pantallas suscriptas.
  useEffect(() => connectDataEvents(), []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeConfigMenu = useCallback(() => {
    setConfigMenuOpen(false);
  }, []);

  // El popover vive en un portal (fuera del aside con overflow), así que hay
  // que chequear tanto el botón como el panel para cerrarlo al clic fuera.
  useEffect(() => {
    if (!configMenuOpen) return;

    const handleClickOutside = (event) => {
      if (configTriggerRef.current?.contains(event.target)) return;
      if (configPopRef.current?.contains(event.target)) return;
      closeConfigMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeConfigMenu();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeConfigMenu);
    window.addEventListener('scroll', closeConfigMenu, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeConfigMenu);
      window.removeEventListener('scroll', closeConfigMenu, true);
    };
  }, [configMenuOpen, closeConfigMenu]);

  // Calcular la posición justo antes del paint: el rect del botón ya existe
  // y evita que el portal aparezca en 0,0 por un estado inicial vacío.
  useLayoutEffect(() => {
    if (!configMenuOpen) return;
    const rect = configTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = isCompact ? 208 : 240;
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12)
    );
    const opensAbove = rect.top > 340;
    setConfigMenuPos({
      left,
      top: rect.bottom + 10,
      bottom: window.innerHeight - rect.top + 10,
      placement: opensAbove ? 'top' : 'bottom',
    });
  }, [configMenuOpen, isCompact]);

  const toggleConfigMenu = () => {
    if (configMenuOpen) closeConfigMenu();
    else setConfigMenuOpen(true);
  };

  const toggleSidebarWidth = () => {
    setSidebarWidth(isCompact ? 'expanded' : 'compact');
  };

  const getSidebarClasses = () => {
    const baseClasses = 'fixed left-0 top-0 z-50 h-full flex flex-col transform transition-all duration-300 ease-in-out vpm-sidebar';
    const widthClasses = {
      compact: 'w-24 lg:w-24 vpm-sidebar--compact',
      expanded: 'w-60 lg:w-60'
    };
    return `${baseClasses} ${widthClasses[isCompact ? 'compact' : 'expanded']} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`;
  };

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Escritorio' },
    { path: '/nueva-venta', icon: Plus, label: 'Nueva Venta' },
    { path: '/ventas', icon: ShoppingCart, label: 'Ventas' },
    { path: '/productos', icon: Package, label: 'Productos' },
    { path: '/presupuestos', icon: FileText, label: 'Presupuestos' },
    { path: '/clientes', icon: Users, label: 'Ctas. Ctes.' },
    { path: '/proveedores', icon: Truck, label: 'Proveedores' },
    { path: '/egresos', icon: TrendingDown, label: 'Egresos' },
    { path: '/mercadopago', icon: MercadopagoIcon, label: 'Mercadopago' },
    { path: '/ia', icon: Bot, label: 'Chat IA' },
    { path: '/recomendaciones', icon: Sparkles, label: 'Recomendaciones' },
  ];

  const menuItems = allMenuItems.filter(
    (item) => !(Array.isArray(hiddenSidebarItems) ? hiddenSidebarItems : []).includes(item.path)
  );

  // El mockup separa la CTA de la navegación y agrupa los enlaces por sección.
  // Es solo presentación: las rutas y `hiddenSidebarItems` siguen igual.
  const ctaItem = menuItems.find((item) => item.path === '/nueva-venta');
  const navItems = menuItems.filter((item) => item.path !== '/nueva-venta');
  const navGroups = [
    { label: 'General', paths: ['/dashboard', '/ventas', '/productos', '/presupuestos'] },
    { label: 'Finanzas', paths: ['/clientes', '/proveedores', '/egresos', '/mercadopago'] },
    { label: 'Herramientas', paths: ['/ia', '/recomendaciones'] }
  ];

  // Items del menú de configuración según rol
  const getAllConfigMenuItems = () => [
    { path: '/configuracion', icon: SettingsIcon, label: 'Configuración' },
    { path: '/login-registros', icon: LogIn, label: 'Registros' },
    { path: '/auditoria', icon: History, label: 'Auditoría' },
    { path: '/usuarios', icon: Shield, label: 'Usuarios' },
    { path: '/herramientas', icon: Wrench, label: 'Herramientas' },
  ];

  const getConfigMenuItems = () => {
    const allItems = getAllConfigMenuItems().filter(
      (item) => FEATURES.herramientas || item.path !== '/herramientas'
    );
    if (user?.rol === 'admin') {
      return allItems;
    } else {
      // Usuarios comunes solo ven "Configuración"
      return allItems.filter(item => item.path === '/configuracion');
    }
  };

  const configMenuItems = getConfigMenuItems();

  return (
    <div className="min-h-screen bg-background vpm-app">
      {/* MOBILE HEADER - Solo visible en móviles */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 vpm-mobile-bar">
        <div className="vpm-brand">
          <img src={logoImage} alt="Vino por Mí" />
          <span className="vpm-brand-title">Vino <em>Por Mí</em></span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          aria-label="Abrir menú"
          className="vpm-icon-btn"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* SIDEBAR - Responsive */}
      <aside aria-label="Navegación principal" className={`${!sidebarVisible ? 'hidden' : ''} ${getSidebarClasses()}`}>
        {/* Close button for mobile */}
        <div className="lg:hidden p-4 border-b border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            aria-label="Cerrar menú"
            className="vpm-icon-btn"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="vpm-sidebar-header">
          <div className="vpm-brand">
            <img src={logoImage} alt="Vino por Mí" />
            <div>
              <span className="vpm-brand-title">Vino <em>Por Mí</em></span>
              <span className="vpm-brand-sub">Gestión</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebarWidth}
              aria-label={isCompact ? 'Expandir menú' : 'Comprimir menú'}
              title={`${isCompact ? 'Expandir' : 'Comprimir'} sidebar`}
              className="vpm-icon-btn vpm-sidebar-toggle"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isCompact ? '' : 'rotate-180'}`} />
            </Button>
          </div>
        </div>

        {ctaItem && (
          <Link
            to={ctaItem.path}
            className="vpm-cta-sale"
            onClick={() => {
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
          >
            <span>
              <Plus className="w-5 h-5" />
              {ctaItem.label}
            </span>
          </Link>
        )}

        <nav className="flex-1 vpm-nav">
          {navGroups.map((group) => {
            const items = navItems.filter((item) => group.paths.includes(item.path));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <p className="vpm-nav-label">{group.label}</p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={isActive ? 'page' : undefined}
                      className={`vpm-nav-link ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        // Cerrar sidebar en móviles al navegar
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }}
                      title={item.label}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                      {item.path === '/clientes' && (
                        debtCount === null ? (
                          <Skeleton variant="sm" width="1.5rem" className="vpm-nav-badge" />
                        ) : debtCount > 0 ? (
                          <span className="vpm-nav-badge" aria-label={`${debtCount} clientes en cuenta corriente`}>
                            {debtCount}
                          </span>
                        ) : null
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

<div className="p-2 border-t border-border">
          <div className="vpm-user-card" title={`${user?.nombre} (@${user?.username})`}>
            <div className="vpm-avatar" aria-hidden="true">
              {user?.nombre?.charAt(0)?.toUpperCase()}
            </div>
            <div className="vpm-user-info">
              <span className="vpm-user-name">{user?.nombre}</span>
              <span className="vpm-user-handle">@{user?.username}</span>
            </div>

            <div className="vpm-user-actions">
              {user && (
                <Button
                  ref={configTriggerRef}
                  onClick={toggleConfigMenu}
                  variant="ghost"
                  size="sm"
                  aria-label="Configuración"
                  aria-expanded={configMenuOpen}
                  aria-controls="layout-config-pop"
                  title="Configuración"
                  className="vpm-icon-btn"
                >
                  <SettingsIcon className="w-4 h-4" />
                </Button>
              )}

              <Button
                onClick={() => {
                  handleLogout();
                  setSidebarOpen(false); // Cerrar sidebar en móviles
                }}
                variant="ghost"
                size="sm"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="vpm-icon-btn"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* OVERLAY para móviles cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 vpm-scrim"
          onClick={toggleSidebar}
        />
      )}

      {/* CONTENT */}
      <main className={`vpm-main min-h-screen p-4 lg:p-8 overflow-x-auto pt-14 lg:pt-8 transition-all duration-300 ${
        !sidebarVisible ? 'lg:ml-0' :
        isCompact ? 'lg:ml-24' :
        'lg:ml-60'
      }`}>
        <div className="max-w-7xl mx-auto pt-4 lg:pt-0">
          <Outlet />
        </div>
      </main>

      {/* FloatingMenu - Solo para usuarios autenticados y con la configuración activada */}
      {user && floatingMenu && <FloatingMenu />}
      <BackgroundSync />
      <WelcomeModal />

      {/* Menú de configuración: portal para que el overflow del sidebar no lo recorte. */}
      {user && configMenuOpen && configMenuPos && createPortal(
        <div
          id="layout-config-pop"
          ref={configPopRef}
          role="menu"
          aria-label="Configuración"
          data-placement={configMenuPos.placement}
          data-sidebar-width={isCompact ? 'compact' : 'expanded'}
          className="vpm-config-pop vpm-config-pop--modern"
          style={
            configMenuPos.placement === 'top'
              ? { left: configMenuPos.left, bottom: configMenuPos.bottom }
              : { left: configMenuPos.left, top: configMenuPos.top }
          }
        >
          <div className="vpm-config-pop-head">
            <span className="vpm-config-pop-avatar" aria-hidden="true">
              {user?.nombre?.charAt(0)?.toUpperCase()}
            </span>
            <div className="vpm-config-pop-user">
              <strong>{user?.nombre}</strong>
              <span>@{user?.username}</span>
            </div>
          </div>

          <p className="vpm-config-pop-label">Configuración</p>
          <div className="vpm-config-pop-items">
            {configMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  role="menuitem"
                  className={location.pathname === item.path ? 'active' : ''}
                  onClick={() => {
                    closeConfigMenu();
                    setSidebarOpen(false);
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="vpm-config-pop-divider" />
          <div className="vpm-config-pop-row">
            <div className="vpm-config-pop-row-label">
              <Moon className="w-4 h-4 flex-shrink-0" />
              <span>Modo oscuro</span>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Layout;
