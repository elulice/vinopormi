import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora, además de foco/visibilidad

/**
 * Detecta cuando el Service Worker instala una nueva versión de la app y
 * recarga la página automáticamente, para que el usuario no tenga que hacer
 * CTRL+F5 / vaciar caché manualmente.
 *
 * Requiere Workbox con skipWaiting + clientsClaim (ya configurado en craco.config.js).
 */
const AutoUpdater = () => {
  const hadControllerRef = useRef(
    Boolean(window.__VPM_HAD_SW_CONTROLLER__ ?? navigator.serviceWorker?.controller)
  );
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let registrationRef = null;
    let intervalId = null;
    let removed = false;

    const checkForUpdates = () => {
      try {
        registrationRef?.update?.().catch(() => {});
      } catch {
        // ignorar
      }
    };

    const onFocus = () => checkForUpdates();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };

    const onControllerChange = () => {
      if (!hadControllerRef.current) {
        // Primera instalación del SW: la página ya es la versión nueva, no recargar.
        hadControllerRef.current = true;
        window.__VPM_HAD_SW_CONTROLLER__ = true;
        return;
      }
      if (reloadingRef.current) return;
      reloadingRef.current = true;

      toast('Nueva versión disponible', {
        description: 'Actualizando la aplicación automáticamente…',
        duration: 2500,
      });
      window.setTimeout(() => {
        window.location.reload();
      }, 1500);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.ready
      .then((registration) => {
        if (removed) return;
        registrationRef = registration;

        registration.onupdatefound = () => {
          // Hay una nueva versión instalándose; con skipWaiting se activa sola
          // y dispara controllerchange, que hace el reload.
          hadControllerRef.current =
            hadControllerRef.current || Boolean(navigator.serviceWorker.controller);
        };

        // Chequeo inicial + periódico
        checkForUpdates();
        intervalId = window.setInterval(checkForUpdates, CHECK_INTERVAL_MS);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
      })
      .catch(() => {
        // Sin SW disponible: seguir funcionando normalmente
      });

    return () => {
      removed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (registrationRef) registrationRef.onupdatefound = null;
    };
  }, []);

  return null;
};

export default AutoUpdater;
