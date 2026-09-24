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
  ChevronDown,
  LogOut,
  ChevronUp,
  Moon,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useState, useRef, useEffect } from 'react';
import { logoImage } from '@/assets/images';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import BackgroundSync from '@/components/BackgroundSync';

const Layout = () => {
  const { user, logout } = useAuth();
  const { sidebarWidth, setSidebarWidth, floatingMenu, darkMode, setDarkMode } = useConfig();
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
    const baseClasses = 'fixed left-0 top-0 z-50 h-full bg-card border-r border-border flex flex-col shadow-lg transform transition-all duration-300 ease-in-out';
    const widthClasses = {
      compact: 'w-30 lg:w-30',
      normal: 'w-56 lg:w-56',
      expanded: 'w-72 lg:w-72'
    };
    return `${baseClasses} ${widthClasses[sidebarWidth]} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`;
  };

  const menuItems = [
{ path: '/dashboard', icon: LayoutDashboard, label: 'Escritorio' },    
    { path: '/nueva-venta', icon: Plus, label: 'Nueva Venta' },            
    { path: '/ventas', icon: ShoppingCart, label: 'Ventas' },              
{ path: '/productos', icon: Package, label: 'Productos' },             
    { path: '/clientes', icon: Users, label: 'Ctas. Ctes.' },
    { path: '/proveedores', icon: Truck, label: 'Proveedores' },
    { path: '/egresos', icon: TrendingDown, label: 'Egresos' },
    { path: '/mercadopago', icon: MercadopagoIcon, label: 'Mercadopago' }, 
    { path: '/recomendaciones', icon: Sparkles, label: 'IA' },
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
    <div className="min-h-screen bg-background">
      {/* MOBILE HEADER - Solo visible en móviles */}
      <div className="lg:hidden bg-card border-b border-border fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 ml-2">
              <img 
                src={logoImage} 
                alt="Vinoteca Logo" 
                className="w-6 h-6 rounded-full object-cover"
              />
            <h1 className="text-lg font-bold text-foreground">Vino Por Mi</h1>
          </div>
        </div>
      </div>

      {/* SIDEBAR - Responsive */}
      <div className={`${!sidebarVisible ? 'hidden' : ''} ${getSidebarClasses()}`}>
        {/* Close button for mobile */}
        <div className="lg:hidden p-4 border-b border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className={`${sidebarWidth === 'compact' ? 'p-3' : 'p-4'} border-b border-border`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${sidebarWidth === 'compact' ? '' : 'gap-3'}`}>
              <img 
                src={logoImage} 
                alt="Vinoteca Logo" 
                className={`${sidebarWidth === 'compact' ? 'w-6 h-6' : 'w-10 h-10'} flex-shrink-0 rounded-full object-cover`}
              />
              {sidebarWidth !== 'compact' && (
                <div>
                  <h1 className="text-xl font-bold text-foreground">Vino Por Mi</h1>
                  <p className="text-xs text-muted-foreground">Sistema de Gestión</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebarWidth}
              className="p-1"
              title={`${sidebarWidth === 'compact' ? 'Expandir' : 'Comprimir'} sidebar`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarWidth === 'expanded' ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
 
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center ${sidebarWidth === 'compact' ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => {
                      // Cerrar sidebar en móviles al navegar
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false);
                      }
                    }}
                    title={sidebarWidth === 'compact' ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" color={isActive ? "white" : undefined} />
                    {sidebarWidth !== 'compact' && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

<div className="p-2 border-t border-border">
          {/* Usuario - fila compacta */}
          <div
            className={`flex items-center mb-2 ${sidebarWidth === 'compact' ? 'justify-center' : 'gap-2 px-1'}`}
            title={`${user?.nombre} (@${user?.username})`}
          >
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">
                {user?.nombre?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            {sidebarWidth !== 'compact' && (
              <p className="text-xs text-foreground truncate min-w-0">
                {user?.nombre}{' '}
                <span className="text-muted-foreground">@{user?.username}</span>
              </p>
            )}
          </div>

          {/* Configuración + Cerrar sesión en una sola fila */}
          <div className={`flex items-center gap-2 ${sidebarWidth === 'compact' ? 'justify-center' : ''}`}>
            {user && (
              <div className={`relative ${sidebarWidth === 'compact' ? '' : 'flex-1 min-w-0'}`} ref={configMenuRef}>
                <Button
                  onClick={() => {
                    toggleConfigMenu();
                  }}
                  variant="outline"
                  size="sm"
                  className={`${sidebarWidth === 'compact' ? 'w-8 px-0 justify-center' : 'w-full justify-between'}`}
                  title={sidebarWidth === 'compact' ? 'Configuración' : undefined}
                >
                  <span className="flex items-center min-w-0">
                    <SettingsIcon className="w-4 h-4 flex-shrink-0" />
                    {sidebarWidth !== 'compact' && (
                      <span className="ml-2 truncate">Configuración</span>
                    )}
                  </span>
                  {sidebarWidth !== 'compact' && (
                    configMenuOpen ? (
                      <ChevronUp className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    )
                  )}
                </Button>

                {/* Menú flotante */}
                {configMenuOpen && (
                 <div className={`absolute bottom-full ${sidebarWidth === 'compact' ? 'left-1/2 transform -translate-x-1/2' : 'left-0 right-0'} mb-2 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-12`}>
                  <div className="py-1">
                    {configMenuItems.map((item, index) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center ${sidebarWidth === 'compact' ? 'justify-center' : ''} px-4 py-3 text-sm hover:bg-muted transition-colors ${
                          location.pathname === item.path
                            ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-r-2 border-blue-600 dark:border-blue-500'
                            : 'text-muted-foreground'
                        }`}
                        title={sidebarWidth === 'compact' ? item.label : undefined}
                        onClick={() => {
                          setConfigMenuOpen(false);
                          setSidebarOpen(false); // Cerrar sidebar en móviles
                        }}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {sidebarWidth !== 'compact' && (
                          <span className="font-medium ml-3">{item.label}</span>
                        )}
                      </Link>
                    ))}

                    {/* Modo oscuro - última opción */}
                    <div className="border-t border-border my-1"></div>
                    <div className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Moon className="w-4 h-4 flex-shrink-0" />
                        {sidebarWidth !== 'compact' && (
                          <span className="font-medium ml-3">Modo oscuro</span>
                        )}
                      </div>
                      <Switch
                        checked={darkMode}
                        onCheckedChange={setDarkMode}
                      />
                    </div>
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
              variant="outline"
              size="sm"
              className={`flex-shrink-0 w-8 px-0 ${!user ? 'flex-1' : ''}`}
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* OVERLAY para móviles cuando el sidebar está abierto */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleSidebar}
        />
      )}

      {/* CONTENT */}
      <main className={`min-h-screen p-4 lg:p-8 overflow-x-auto pt-14 lg:pt-8 transition-all duration-300 ${
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
    </div>
  );
};

export default Layout;
