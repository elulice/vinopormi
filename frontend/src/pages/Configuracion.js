import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useConfig } from '@/context/ConfigContext';
import { useAuth } from '@/context/AuthContext';
import { Settings as SettingsIcon, Package, Users, Truck, TrendingDown, DollarSign, Loader2, AlertCircle, Menu, LogOut, Calculator, PanelBottom, Bot } from 'lucide-react';
import MercadopagoIcon from '@/components/MercadopagoIcon';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { API } from '@/lib/config';
import { apiGet, apiPost } from '@/lib/api';
import { useDataRefresh } from '@/lib/dataEvents';
import Skeleton from '@/components/Skeleton';

const Configuracion = () => {
  const { showCents, toggleShowCents, floatingMenu, setFloatingMenu, autoLogout, setAutoLogout, loading, error, calcularVuelto, setCalcularVuelto, totalFlotante, setTotalFlotante, hiddenSidebarItems, setHiddenSidebarItems, hiddenFloatingMenuActions, setHiddenFloatingMenuActions } = useConfig();
  const { user } = useAuth();
  const [localShowCents, setLocalShowCents] = useState(showCents);
  const [localFloatingMenu, setLocalFloatingMenu] = useState(floatingMenu);
  const [localAutoLogout, setLocalAutoLogout] = useState(autoLogout);
  const [localCalcularVuelto, setLocalCalcularVuelto] = useState(calcularVuelto);
  const [mercadopagoConfig, setMercadopagoConfig] = useState({ access_token: '' });
  const [savingMercadopago, setSavingMercadopago] = useState(false);
  const [loadingMercadopago, setLoadingMercadopago] = useState(true);

  // Sincronizar estados locales con los globales cuando cambian
  useEffect(() => {
    setLocalShowCents(showCents);
  }, [showCents]);

  useEffect(() => {
    setLocalFloatingMenu(floatingMenu);
  }, [floatingMenu]);

  useEffect(() => {
    setLocalAutoLogout(autoLogout);
  }, [autoLogout]);

  useEffect(() => {
    setLocalCalcularVuelto(calcularVuelto);
  }, [calcularVuelto]);

  // Fetch Mercadopago config
  const fetchMercadopagoConfig = useCallback(async () => {
    try {
      const response = await apiGet(`${API}/mercadopago/configuracion`);
      if (response.data.access_token) {
        setMercadopagoConfig({
          access_token: response.data.access_token
        });
      }
    } catch (err) {
      console.error('Error fetching Mercadopago config:', err);
    } finally {
      setLoadingMercadopago(false);
    }
  }, []);

  useEffect(() => {
    fetchMercadopagoConfig();
  }, [fetchMercadopagoConfig]);

  useDataRefresh(['mp'], fetchMercadopagoConfig);

  const handleSaveMercadopago = async () => {
    setSavingMercadopago(true);
    try {
      await apiPost(
        `${API}/mercadopago/configuracion`,
        {
          access_token: mercadopagoConfig.access_token
        }
      );
      toast.success('Configuración de Mercadopago guardada');
    } catch (err) {
      toast.error('Error al guardar configuración');
    } finally {
      setSavingMercadopago(false);
    }
  };

  const handleToggle = () => {
    const newValue = !localShowCents;
    setLocalShowCents(newValue);
    toggleShowCents();
  };

const handleFloatingMenuToggle = () => {
    const newValue = !localFloatingMenu;
    setLocalFloatingMenu(newValue);
    setFloatingMenu(newValue);
  };

  const handleAutoLogoutToggle = () => {
    const newValue = !localAutoLogout;
    setLocalAutoLogout(newValue);
    setAutoLogout(newValue);
  };

  const handleCalcularVueltoToggle = () => {
    const newValue = !localCalcularVuelto;
    setLocalCalcularVuelto(newValue);
    setCalcularVuelto(newValue);
  };

  const sidebarItemsConfig = [
    { path: '/dashboard', label: 'Escritorio' },
    { path: '/nueva-venta', label: 'Nueva Venta' },
    { path: '/ventas', label: 'Ventas' },
    { path: '/productos', label: 'Productos' },
    { path: '/clientes', label: 'Ctas. Ctes.' },
    { path: '/proveedores', label: 'Proveedores' },
    { path: '/egresos', label: 'Egresos' },
    { path: '/mercadopago', label: 'Mercadopago' },
    { path: '/ia', label: 'Chat IA' },
    { path: '/recomendaciones', label: 'Recomendaciones' },
  ];

  const handleSidebarItemToggle = (path, visible) => {
    const current = Array.isArray(hiddenSidebarItems) ? hiddenSidebarItems : [];
    let next;
    if (visible) {
      next = current.filter((p) => p !== path);
    } else {
      next = current.includes(path) ? current : [...current, path];
    }
    setHiddenSidebarItems(next);
  };

  const floatingMenuActionsConfig = [
    { id: 'product', label: 'Productos', icon: Package, color: 'text-blue-600' },
    { id: 'customer', label: 'Ctas. Ctes.', icon: Users, color: 'text-green-600' },
    { id: 'provider', label: 'Proveedores', icon: Truck, color: 'text-purple-600' },
    { id: 'egress', label: 'Egresos', icon: TrendingDown, color: 'text-red-600' },
    { id: 'mercadopago', label: 'Mercado Pago', icon: MercadopagoIcon, color: 'text-sky-500' },
    { id: 'chatia', label: 'Chat IA', icon: Bot, color: 'text-primary' },
  ];

  const handleFloatingMenuActionToggle = (actionId, visible) => {
    const current = Array.isArray(hiddenFloatingMenuActions) ? hiddenFloatingMenuActions : [];
    let next;
    if (visible) {
      next = current.filter((id) => id !== actionId);
    } else {
      next = current.includes(actionId) ? current : [...current, actionId];
    }
    setHiddenFloatingMenuActions(next);

    // Si no queda ninguna acción habilitada, deshabilitar el menú flotante.
    // Si se habilita al menos una acción, reactivarlo automáticamente.
    const allActionIds = floatingMenuActionsConfig.map((action) => action.id);
    const noneEnabled = allActionIds.every((id) => next.includes(id));
    if (noneEnabled) {
      setLocalFloatingMenu(false);
      setFloatingMenu(false);
    } else if (visible) {
      setLocalFloatingMenu(true);
      setFloatingMenu(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
          <SettingsIcon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza la aplicación
          </p>
        </div>
      </div>

        {/* Tarjeta de configuración de moneda */}
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4" />
            Moneda
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {error && <AlertCircle className="w-3 h-3 text-red-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-cents" className="text-sm font-medium">
                Mostrar centavos
              </Label>
              <p className="text-xs text-muted-foreground">
                Muestra/oculta centavos en los montos
              </p>
            </div>
            <Switch
              id="show-cents"
              checked={localShowCents}
              onCheckedChange={handleToggle}
            />
          </div>

          {/* Vista previa */}
          <div className="border-t pt-2">
            <p className="text-xs font-medium mb-2">Vista previa:</p>
            <div className="p-2 bg-muted rounded-md">
              <span className="text-xs text-muted-foreground mr-2">Ej:</span>
              <span className="font-mono font-semibold text-sm">
                {formatCurrency(1234.56, localShowCents)}
              </span>
            </div>
          </div>

          {/* Estado de conexión */}
          {loading && (
            <div className="border-t pt-2">
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Skeleton variant="circle" size="0.75rem" />
                <span className="text-xs text-muted-foreground">Sincronizando...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tarjeta de configuración de menú flotante */}
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Menu className="w-4 h-4" />
            Menú Flotante
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {error && <AlertCircle className="w-3 h-3 text-red-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="floating-menu" className="text-sm font-medium">
                Menú flotante
              </Label>
              <p className="text-xs text-muted-foreground">
                Acciones rápidas
              </p>
            </div>
            <Switch
              id="floating-menu"
              checked={localFloatingMenu}
              onCheckedChange={handleFloatingMenuToggle}
            />
          </div>

          {/* Acciones del menú flotante */}
          <div className="border-t pt-2">
            <p className="text-xs font-medium mb-2">Acciones</p>
            <p className="text-xs text-muted-foreground mb-2">
              Elegí qué acciones mostrar en el menú flotante. Si no queda ninguna acción habilitada, el menú flotante se deshabilitará; al habilitar una, se reactivará automáticamente. Podés seguir configurando las acciones aunque el menú esté desactivado.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {floatingMenuActionsConfig.map((action) => {
                const Icon = action.icon;
                const visible = !(Array.isArray(hiddenFloatingMenuActions) ? hiddenFloatingMenuActions : []).includes(action.id);
                return (
                  <div key={action.id} className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-3 h-3 ${action.color}`} />
                      <Label htmlFor={`floating-action-${action.id}`} className="text-xs font-medium truncate">
                        {action.label}
                      </Label>
                    </div>
                    <Switch
                      id={`floating-action-${action.id}`}
                      checked={visible}
                      onCheckedChange={(checked) => handleFloatingMenuActionToggle(action.id, checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

  </CardContent>
      </Card>

      {/* Tarjeta de configuración de cierre de sesión automático */}
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <LogOut className="w-4 h-4" />
            Cierre Automático
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {error && <AlertCircle className="w-3 h-3 text-red-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-logout" className="text-sm font-medium">
                Cierre automático
              </Label>
              <p className="text-xs text-muted-foreground">
                Cierra sesión tras 1 hora inactivo
              </p>
            </div>
            <Switch
              id="auto-logout"
              checked={localAutoLogout}
              onCheckedChange={handleAutoLogoutToggle}
            />
          </div>

          {/* Advertencia de seguridad */}
          <div className="border-t pt-2">
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-xs text-amber-800">
                Si el navegador se cierra, el seguimiento no funcionará
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Tarjeta de configuración de cálculo de vuelto */}
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calculator className="w-4 h-4" />
            Cálculo de Vuelto
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {error && <AlertCircle className="w-3 h-3 text-red-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="calcular-vuelto" className="text-sm font-medium">
                Calculadora de vuelto
              </Label>
              <p className="text-xs text-muted-foreground">
                Mostrar calculadora de vuelto en ventas en efectivo
              </p>
            </div>
            <Switch
              id="calcular-vuelto"
              checked={localCalcularVuelto}
              onCheckedChange={handleCalcularVueltoToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta de total flotante/fijo al fondo */}
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PanelBottom className="w-4 h-4" />
            Total en Nueva Venta
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="total-flotante" className="text-sm font-medium">
                Total fijo al fondo
              </Label>
              <p className="text-xs text-muted-foreground">
                Mostrar el total y botones fijos en la parte inferior de Nueva Venta
              </p>
            </div>
            <Switch
              id="total-flotante"
              checked={totalFlotante}
              onCheckedChange={setTotalFlotante}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta de elementos del sidebar */}
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Menu className="w-4 h-4" />
            Elementos del Sidebar
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Elegí qué secciones mostrar u ocultar en la barra lateral.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sidebarItemsConfig.map((item) => {
              const visible = !(Array.isArray(hiddenSidebarItems) ? hiddenSidebarItems : []).includes(item.path);
              return (
                <div key={item.path} className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-md">
                  <Label htmlFor={`sidebar-item-${item.path}`} className="text-sm font-medium truncate">
                    {item.label}
                  </Label>
                  <Switch
                    id={`sidebar-item-${item.path}`}
                    checked={visible}
                    onCheckedChange={(checked) => handleSidebarItemToggle(item.path, checked)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {user?.rol === 'admin' && (
      <Card className="py-2">
        <CardHeader className="py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MercadopagoIcon className="w-4 h-4" />
            Mercadopago
            {loadingMercadopago && <Loader2 className="w-3 h-3 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div>
            <Label htmlFor="mp-access-token" className="text-sm font-medium">
              Access Token
            </Label>
            <Input
              id="mp-access-token"
              type="password"
              value={mercadopagoConfig.access_token}
              onChange={(e) => setMercadopagoConfig({ ...mercadopagoConfig, access_token: e.target.value })}
              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Obtenelo en Mercadopago Developers → Credenciales
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveMercadopago} disabled={savingMercadopago} size="sm">
              {savingMercadopago ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Nota general de configuración */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-800">
          La configuración se guarda en tu perfil
          {error && (
            <span className="block mt-1 text-red-600">
              ⚠️ Problema de conexión
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default Configuracion;