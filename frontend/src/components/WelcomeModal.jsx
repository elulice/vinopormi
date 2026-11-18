import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Save, Move, Bot, Sparkles } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { API } from '@/lib/config';

const SEEN_PREFIX = 'vpm_news_seen_';
const POLL_MS = 60000;

const ICONS = { Save, Move, Bot, Sparkles };

const DEFAULT_DATA = {
  version: 'v1.05',
  features: [
    {
      icon: 'Save',
      title: 'Nueva Venta con borrador persistente',
      description:
        'Ahora lo que cargás en "Nueva Venta" se guarda automáticamente y no se pierde si cambiás de pantalla o recargás. El borrador se limpia al registrar la venta o al cancelar.',
    },
    {
      icon: 'Move',
      title: 'Botón flotante arrastrable',
      description:
        'El menú de accesos rápidos ahora se puede arrastrar y soltar en cualquier parte de la pantalla, guardando su posición por usuario. Doble clic para restablecerlo.',
    },
    {
      icon: 'Bot',
      title: 'Chat IA',
      description:
        'Implementamos el Chat IA para consultar datos del sistema (ventas, productos, cuentas corrientes, proveedores, egresos, MercadoPago y auditoría) con historial por usuario.',
    },
  ],
};

const WelcomeModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [news, setNews] = useState(DEFAULT_DATA);
  const lastVersionRef = useRef(null);
  const fetchingFullRef = useRef(false);

  const fetchFullAndShow = useCallback(async (versionHint) => {
    if (fetchingFullRef.current) return;
    fetchingFullRef.current = true;
    try {
      const res = await apiGet(`${API}/novedades`);
      const data = res?.data && res.data.version ? res.data : { ...DEFAULT_DATA, version: versionHint || DEFAULT_DATA.version };
      const version = data.version || versionHint || DEFAULT_DATA.version;
      const features = Array.isArray(data.features) && data.features.length ? data.features : DEFAULT_DATA.features;
      setNews({ version, features });

      if (localStorage.getItem(`${SEEN_PREFIX}${version}`) !== 'true') {
        setIsOpen(true);
      }
    } catch {
      const version = versionHint || DEFAULT_DATA.version;
      if (localStorage.getItem(`${SEEN_PREFIX}${version}`) !== 'true') {
        setNews({ ...DEFAULT_DATA, version });
        setIsOpen(true);
      }
    } finally {
      fetchingFullRef.current = false;
    }
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`${API}/novedades/version`);
      if (!res.ok) throw new Error('version check failed');
      const data = await res.json();
      const version = data?.version || DEFAULT_DATA.version;

      if (lastVersionRef.current === version) return;
      lastVersionRef.current = version;

      if (localStorage.getItem(`${SEEN_PREFIX}${version}`) !== 'true') {
        await fetchFullAndShow(version);
      }
    } catch {
      // fallback: intentar flujo completo solo si no vimos el default
      const version = DEFAULT_DATA.version;
      if (lastVersionRef.current === version) return;
      lastVersionRef.current = version;
      if (localStorage.getItem(`${SEEN_PREFIX}${version}`) !== 'true') {
        await fetchFullAndShow(version);
      }
    }
  }, [fetchFullAndShow]);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, POLL_MS);
    const onFocus = () => checkVersion();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkVersion]);

  const handleClose = () => {
    const version = news?.version || DEFAULT_DATA.version;
    try {
      localStorage.setItem(`${SEEN_PREFIX}${version}`, 'true');
    } catch {}
    setIsOpen(false);
  };

  const features = Array.isArray(news?.features) && news.features.length ? news.features : DEFAULT_DATA.features;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(true); }}>
      <DialogContent className="max-w-sm bg-background border-border">
        <div className="text-center mb-4">
          <h2 className="font-semibold text-lg text-foreground">Novedades</h2>
        </div>

        <div className="space-y-3 mb-4">
          {features.map((feature, index) => {
            const Icon = ICONS[feature.icon] || Sparkles;
            return (
              <div key={index} className="flex gap-3 p-2">
                <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleClose}
          className="w-full py-2 text-sm bg-primary text-primary-foreground font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          Cerrar
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
