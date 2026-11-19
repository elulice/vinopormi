import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import FloatingMenu from '@/components/FloatingMenu';
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
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useState, useRef, useEffect } from 'react';
import { logoImage } from '@/assets/images';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import BackgroundSync from '@/components/BackgroundSync';
import WelcomeModal from '@/components/WelcomeModal';
import '@/components/DashboardV4.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const { sidebarWidth, setSidebarWidth, floatingMenu, darkMode, setDarkMode, hiddenSidebarItems } = useConfig();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const configMenuRef = useRef(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSidebarVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Cerrar menú de configuración al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (configMenuRef.current && !configMenuRef.current.contains(event.target)) {
        setConfigMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleConfigMenu = () => {
    setConfigMenuOpen(!configMenuOpen);
  };

  const toggleSidebarWidth = () => {
    const widths = ['compact', 'normal', 'expanded'];
    const currentIndex = widths.indexOf(sidebarWidth);
    const nextIndex = (currentIndex + 1) % widths.length;
    setSidebarWidth(widths[nextIndex]);
  };

  const getSidebarClasses = () => {
    const baseClasses = 'fixed left-0 top-0 z-50 h-full flex flex-col transform transition-all duration-300 ease-in-out vpm-sidebar';
    const widthClasses = {
      compact: 'w-30 lg:w-30 vpm-sidebar--compact',
      normal: 'w-56 lg:w-56',
      expanded: 'w-72 lg:w-72'
    };
    return `${baseClasses} ${widthClasses[sidebarWidth]} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`;
  };

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Escritorio' },
    { path: '/nueva-venta', icon: Plus, label: 'Nueva Venta' },
    { path: '/ventas', icon: ShoppingCart, label: 'Ventas' },
    { path: '/productos', icon: Package, label: 'Productos' },
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
    { label: 'General', paths: ['/dashboard', '/ventas', '/productos'] },
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
    const allItems = getAllConfigMenuItems();
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
      <div className={`${!sidebarVisible ? 'hidden' : ''} ${getSidebarClasses()}`}>
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
              aria-label={sidebarWidth === 'compact' ? 'Expandir menú' : 'Comprimir menú'}
              title={`${sidebarWidth === 'compact' ? 'Expandir' : 'Comprimir'} sidebar`}
              className="vpm-icon-btn"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarWidth === 'compact' ? '' : 'rotate-180'}`} />
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
                <ul className="vpm-nav-list">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <Link
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
                        </Link>
                      </li>
                    );
                  })}
                </ul>
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
                <div className="relative" ref={configMenuRef}>
                  <Button
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

                  {configMenuOpen && (
                    <div
                      id="layout-config-pop"
                      role="menu"
                      aria-label="Configuración"
                      className="absolute bottom-full left-0 mb-2 w-56 py-1 vpm-config-pop"
                    >
                      {configMenuItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          role="menuitem"
                          className={location.pathname === item.path ? 'active' : ''}
                          onClick={() => {
                            setConfigMenuOpen(false);
                            setSidebarOpen(false); // Cerrar sidebar en móviles
                          }}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      ))}

                      <div className="my-1 border-t border-border" />
                      <div className="flex items-center justify-between gap-3 px-4 py-2">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Moon className="w-4 h-4 flex-shrink-0" />
                          <span>Modo oscuro</span>
                        </div>
                        <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                      </div>
                    </div>
                  )}
                </div>
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
      </div>

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
        sidebarWidth === 'compact' ? 'lg:ml-24' : 
        sidebarWidth === 'normal' ? 'lg:ml-56' : 
        'lg:ml-72'
      }`}>
        <div className="max-w-7xl mx-auto pt-4 lg:pt-0">
          <Outlet />
        </div>
      </main>

      {/* FloatingMenu - Solo para usuarios autenticados y con la configuración activada */}
      {user && floatingMenu && <FloatingMenu />}
      <BackgroundSync />
      <WelcomeModal />
    </div>
  );
};

export default Layout;
