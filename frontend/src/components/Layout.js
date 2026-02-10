import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
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
  Building,
  Plus,
  Wrench,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { logoImage } from '@/assets/images';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const configMenuRef = useRef(null);

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

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Escritorio' },
    { path: '/nueva-venta', icon: Plus, label: 'Nueva Venta' },
    { path: '/ventas', icon: ShoppingCart, label: 'Ventas' },
    { path: '/productos', icon: Package, label: 'Productos' },
    { path: '/clientes', icon: Users, label: 'Clientes' },
    { path: '/proveedores', icon: Building, label: 'Proveedores' },
    { path: '/egresos', icon: TrendingDown, label: 'Egresos' },
  ];

  // Items del menú de configuración (solo para admin)
  const configMenuItems = [
    { path: '/configuracion', icon: SettingsIcon, label: 'Configuración' },
    { path: '/login-registros', icon: LogIn, label: 'Registros' },
    { path: '/auditoria', icon: History, label: 'Auditoría' },
    { path: '/usuarios', icon: Shield, label: 'Usuarios' },
    { path: '/herramientas', icon: Wrench, label: 'Herramientas' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* MOBILE HEADER - Solo visible en móviles */}
      <div className="lg:hidden bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img 
              src={logoImage} 
              alt="Vinoteca Logo" 
              className="w-6 h-6"
            />
            <h1 className="text-lg font-bold text-foreground">Vino Por Mi</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* SIDEBAR - Responsv */}
      <div className={`
        fixed left-0 top-0 z-50 h-full bg-white border-r border-gray-200 flex flex-col shadow-lg
        w-64 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:w-64
      `}>
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

        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img 
              src={logoImage} 
              alt="Vinoteca Logo" 
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">Vino Por Mi</h1>
              <p className="text-xs text-muted-foreground">Sistema de Gestión</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
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
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-foreground">
              {user?.nombre}
            </p>
            <p className="text-xs text-muted-foreground">
              @{user?.username}
            </p>
          </div>

          {/* Menú de configuración - Solo para admin */}
          {user?.rol === 'admin' && (
            <div className="relative mb-2" ref={configMenuRef}>
              <Button
                onClick={() => {
                  toggleConfigMenu();
                }}
                variant="outline"
                className="w-full justify-between"
              >
                <div className="flex items-center">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Configuración
                </div>
                {configMenuOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>

              {/* Menú flotante */}
              {configMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    {configMenuItems.map((item, index) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                          location.pathname === item.path
                            ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                            : 'text-gray-700'
                        }`}
                        onClick={() => {
                          setConfigMenuOpen(false);
                          setSidebarOpen(false); // Cerrar sidebar en móviles
                        }}
                      >
                        <item.icon className="w-4 h-4 mr-3 flex-shrink-0" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    ))}
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
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
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
      <main className="lg:ml-64 min-h-screen p-4 lg:p-8 overflow-x-auto pt-14 lg:pt-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
