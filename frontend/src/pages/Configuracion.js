import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/context/ConfigContext';
import { Settings as SettingsIcon, DollarSign, Loader2, AlertCircle, Menu } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

const Configuracion = () => {
  const { showCents, toggleShowCents, floatingMenu, setFloatingMenu, loading, error } = useConfig();
  const [localShowCents, setLocalShowCents] = useState(showCents);
  const [localFloatingMenu, setLocalFloatingMenu] = useState(floatingMenu);

  const handleToggle = () => {
    setLocalShowCents(!localShowCents);
    toggleShowCents();
  };

  const handleFloatingMenuToggle = () => {
    const newValue = !localFloatingMenu;
    setLocalFloatingMenu(newValue);
    setFloatingMenu(newValue);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">
            Personaliza la configuración de la aplicación
          </p>
        </div>
      </div>

          {/* Tarjeta de configuración de moneda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Configuración de Moneda
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {error && <AlertCircle className="w-4 h-4 text-red-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-cents" className="text-base font-medium">
                Mostrar centavos
              </Label>
              <p className="text-sm text-muted-foreground">
                Muestra u oculta los centavos en los montos de dinero en toda la aplicación
              </p>
            </div>
            <Switch
              id="show-cents"
              checked={localShowCents}
              onCheckedChange={handleToggle}
            />
          </div>

          {/* Vista previa */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Vista previa:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-muted-foreground">Ejemplo 1:</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(1234.56, localShowCents)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-muted-foreground">Ejemplo 2:</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(999.00, localShowCents)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-muted-foreground">Ejemplo 3:</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(50.50, localShowCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="border-t pt-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Esta configuración se guarda en tu perfil de usuario 
                y estará disponible en todos los dispositivos donde inicies sesión.
                {error && (
                  <span className="block mt-2 text-red-600">
                    ⚠️ Hay un problema de conexión. Los cambios se guardarán temporalmente.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Estado de conexión */}
          {loading && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Sincronizando configuración...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tarjeta de configuración de menú flotante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Menu className="w-5 h-5" />
            Configuración de Menú Flotante
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {error && <AlertCircle className="w-4 h-4 text-red-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="floating-menu" className="text-base font-medium">
                Habilitar menú flotante
              </Label>
              <p className="text-sm text-muted-foreground">
                Activa el menú flotante de acciones rápidas en la parte superior derecha de la pantalla
              </p>
            </div>
            <Switch
              id="floating-menu"
              checked={localFloatingMenu}
              onCheckedChange={handleFloatingMenuToggle}
            />
          </div>

          {/* Descripción de funcionalidades */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Acciones rápidas disponibles:</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                  📦
                </div>
                <div>
                  <p className="text-sm font-medium">Buscar Producto</p>
                  <p className="text-xs text-muted-foreground">Buscar, editar y crear productos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                  👤
                </div>
                <div>
                  <p className="text-sm font-medium">Buscar Cliente</p>
                  <p className="text-xs text-muted-foreground">Buscar, editar y crear clientes</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center">
                  🏢
                </div>
                <div>
                  <p className="text-sm font-medium">Buscar Proveedor</p>
                  <p className="text-xs text-muted-foreground">Buscar, editar y crear proveedores</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                  💰
                </div>
                <div>
                  <p className="text-sm font-medium">Nuevo Egreso</p>
                  <p className="text-xs text-muted-foreground">Registrar nuevos egresos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="border-t pt-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Esta configuración se guarda en tu perfil de usuario 
                y estará disponible en todos los dispositivos donde inicies sesión.
                {error && (
                  <span className="block mt-2 text-red-600">
                    ⚠️ Hay un problema de conexión. Los cambios se guardarán temporalmente.
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuracion;