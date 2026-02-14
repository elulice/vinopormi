import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import FloatingMenu from '@/components/FloatingMenu';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  LogOut,
  Menu,
  TrendingDown,
  Shield,
  Settings as SettingsIcon,
  X,
  LogIn,
  History,
  Truck,
  Plus,
  Wrench,
  ChevronDown,
  ChevronUp,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { logoImage } from '@/assets/images';

const Layout = () => {
  const { user, logout } = useAuth();
  const { sidebarWidth, setSidebarWidth, floatingMenu } = useConfig();
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
    const baseClasses = 'fixed left-0 top-0 z-50 h-full bg-white border-r border-gray-200 flex flex-col shadow-lg transform transition-all duration-300 ease-in-out';
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
    <div className="min-h-screen bg-gray-50">
      {/* MOBILE HEADER - Solo visible en móviles */}
      <div className="lg:hidden bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
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
              className="w-6 h-6"
            />
            <h1 className="text-lg font-bold text-foreground">Vino Por Mi</h1>
          </div>
        </div>
      </div>

      {/* SIDEBAR - Responsive */}
      <div className={`${!sidebarVisible ? 'hidden' : ''} ${getSidebarClasses()}`}>
        {/* Close button for mobile */}
        <div className="lg:hidden p-4 border-b border-gray-200 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className={`${sidebarWidth === 'compact' ? 'p-3' : 'p-4'} border-b border-gray-200`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${sidebarWidth === 'compact' ? '' : 'gap-3'}`}>
              <img 
                src={logoImage} 
                alt="Vinoteca Logo" 
                className={`${sidebarWidth === 'compact' ? 'w-6 h-6' : 'w-10 h-10'} flex-shrink-0`}
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
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      // Cerrar sidebar en móviles al navegar
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false);
                      }
                    }}
                    title={sidebarWidth === 'compact' ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarWidth !== 'compact' && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={`${sidebarWidth === 'compact' ? 'p-2' : 'p-4'} border-t border-gray-200`}>
          <div className={`mb-3 ${sidebarWidth === 'compact' ? 'text-center' : 'px-2'}`}>
            {sidebarWidth !== 'compact' ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  {user?.nombre}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{user?.username}
                </p>
              </>
            ) : (
              <div className="flex justify-center">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {user?.nombre?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Menú de configuración - Para todos los usuarios */}
          {user && (
            <div className="relative text-center mb-2" ref={configMenuRef}>
              <Button
                onClick={() => {
                  toggleConfigMenu();
                }}
                variant="outline"
                className={`${sidebarWidth === 'compact' ? 'p-2' : 'w-full justify-between'}`}
                title={sidebarWidth === 'compact' ? 'Configuración' : undefined}
              >
                {sidebarWidth === 'compact' ? (
                  <SettingsIcon className="w-4 h-4" />
                ) : (
                  <>
                    <div className="flex items-center">
                      <SettingsIcon className="w-4 h-4 mr-2" />
                      Configuración
                    </div>
                    {configMenuOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </>
                )}
              </Button>

              {/* Menú flotante */}
              {configMenuOpen && (
                <div className={`absolute bottom-full ${sidebarWidth === 'compact' ? 'left-1/2 transform -translate-x-1/2' : 'left-0 right-0'} mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-12`}>
                  <div className="py-1">
                    {configMenuItems.map((item, index) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center ${sidebarWidth === 'compact' ? 'justify-center' : ''} px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                          location.pathname === item.path
                            ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                            : 'text-gray-700'
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
                  </div>
                </div>
              )}
            </div>
          )}
<div className="relative text-center mb-2">
          <Button
            onClick={() => {
              handleLogout();
              setSidebarOpen(false); // Cerrar sidebar en móviles
            }}
            variant="outline"
            className={`${sidebarWidth === 'compact' ? 'p-2' : 'w-full justify-start'}`}
            title={sidebarWidth === 'compact' ? 'Cerrar Sesión' : undefined}
          >
            {sidebarWidth === 'compact' ? (
              <LogOut className="w-4 h-4" />
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </>
            )}
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
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* FloatingMenu - Solo para usuarios autenticados y con la configuración activada */}
      {user && floatingMenu && <FloatingMenu />}
    </div>
  );
};

export default Layout;
