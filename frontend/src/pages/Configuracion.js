import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/context/ConfigContext';
import { Settings as SettingsIcon, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

const Configuracion = () => {
  const { showCents, toggleShowCents, loading, error } = useConfig();
  const [localShowCents, setLocalShowCents] = useState(showCents);

  const handleToggle = () => {
    setLocalShowCents(!localShowCents);
    toggleShowCents();
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
    </div>
  );
};

export default Configuracion;