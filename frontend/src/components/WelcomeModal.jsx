import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Save, Move, Bot, Sparkles, Mic, Tags } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { API } from '@/lib/config';

const SEEN_PREFIX = 'vpm_news_seen_';
const POLL_MS = 60000;

const ICONS = { Save, Move, Bot, Sparkles, Mic, Tags };

const WelcomeModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [news, setNews] = useState({ version: null, features: [] });
  const lastVersionRef = useRef(null);
  const fetchingFullRef = useRef(false);

  const fetchFullAndShow = useCallback(async (versionHint) => {
    if (fetchingFullRef.current) return false;
    fetchingFullRef.current = true;
    try {
      const res = await apiGet(`${API}/novedades`);
      const data = res?.data;
      const version = data?.version || versionHint;
      const features = Array.isArray(data?.features) && data.features.length ? data.features : [];
      if (!version || !features.length) return false;

      setNews({ version, features });
      if (localStorage.getItem(`${SEEN_PREFIX}${version}`) !== 'true') {
        setIsOpen(true);
      }
      return true;
    } catch {
      // Sin backend no mostramos novedades; se reintenta en el próximo chequeo.
      return false;
    } finally {
      fetchingFullRef.current = false;
    }
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`${API}/novedades/version`);
      if (!res.ok) throw new Error('version check failed');
      const data = await res.json();
      const version = data?.version;
      if (!version || lastVersionRef.current === version) return;

      if (localStorage.getItem(`${SEEN_PREFIX}${version}`) === 'true') {
        lastVersionRef.current = version;
        return;
      }

      // Solo marcamos la versión como procesada si pudimos cargar las novedades,
      // así un fallo momentáneo del backend no oculta el modal para siempre.
      if (await fetchFullAndShow(version)) {
        lastVersionRef.current = version;
      }
    } catch {
      // Backend no disponible: no marcamos versión para reintentar luego.
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
    const version = news?.version;
    if (version) {
      try {
        localStorage.setItem(`${SEEN_PREFIX}${version}`, 'true');
      } catch {}
    }
    setIsOpen(false);
  };

  const features = Array.isArray(news?.features) ? news.features : [];

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
