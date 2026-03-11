import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '@/lib/config';
import { apiGet, apiPost } from '@/lib/api';
import {
  obtenerVentasPendientes,
  marcarVentaComoSincronizada,
  obtenerEgresosPendientes,
  marcarEgresoComoSincronizado,
  db
} from '@/db/offlineDB';

const BackgroundSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(null);
  const syncInProgress = useRef(false);
  const intervalRef = useRef(null);
  const prevServerAvailable = useRef(null);
  const sincronizarTodoRef = useRef(null);
  const syncTriggeredRef = useRef(false);

  const ventasPendientesCount = useLiveQuery(async () => {
    const todas = await db.ventas_pendientes.toArray();
    return todas.filter(v => v.sincronizado === false).length;
  });

  const egresosPendientesCount = useLiveQuery(async () => {
    const todas = await db.egresos_pendientes.toArray();
    return todas.filter(e => e.sincronizado === false).length;
  });

  useEffect(() => {
    const totalPendientes = (ventasPendientesCount || 0) + (egresosPendientesCount || 0);
    if (totalPendientes > 0 && serverAvailable === true && !syncInProgress.current && !syncTriggeredRef.current) {
      syncTriggeredRef.current = true;
      if (sincronizarTodoRef.current) {
        sincronizarTodoRef.current().finally(() => {
          setTimeout(() => {
            syncTriggeredRef.current = false;
          }, 2000);
        });
      }
    }
  }, [ventasPendientesCount, egresosPendientesCount, serverAvailable]);

  const checkServer = async () => {
    const totalPendientes = (ventasPendientesCount || 0) + (egresosPendientesCount || 0);
    
    try {
      await apiGet(`${API}/productos-paginados?limit=1`, { timeout: 5000 });
      if (prevServerAvailable.current === false) {
        setServerAvailable(true);
        prevServerAvailable.current = true;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (totalPendientes > 0 && sincronizarTodoRef.current) {
          sincronizarTodoRef.current();
        }
      } else if (prevServerAvailable.current === null || prevServerAvailable.current === true) {
        setServerAvailable(true);
        prevServerAvailable.current = true;
      }
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        if (prevServerAvailable.current === false) {
          setServerAvailable(true);
          prevServerAvailable.current = true;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (totalPendientes > 0 && sincronizarTodoRef.current) {
            sincronizarTodoRef.current();
          }
        } else if (prevServerAvailable.current === null || prevServerAvailable.current === true) {
          setServerAvailable(true);
          prevServerAvailable.current = true;
        }
        return true;
      }
      if (prevServerAvailable.current !== false) {
        setServerAvailable(false);
        prevServerAvailable.current = false;
        intervalRef.current = setInterval(checkServer, 10000);
      }
      return false;
    }
  };

  const sincronizarVentas = async () => {
    const ventasPendientes = await obtenerVentasPendientes();
    
    for (const venta of ventasPendientes) {
      try {
        const { id, fecha_creacion, sincronizado, ...data } = venta;
        await apiPost(`${API}/ventas`, data);
        await marcarVentaComoSincronizada(id);
      } catch (error) {
        if (error.response?.status >= 400 && error.response?.status < 500) {
          console.warn(`Venta ${venta.id} falló por error de lógica:`, error.response?.data);
        }
      }
    }
  };

  const sincronizarEgresos = async () => {
    const egresosPendientes = await obtenerEgresosPendientes();
    
    for (const egreso of egresosPendientes) {
      try {
        const { id, fecha_creacion, sincronizado, ...data } = egreso;
        await apiPost(`${API}/egresos`, data);
        await marcarEgresoComoSincronizado(id);
      } catch (error) {
        if (error.response?.status >= 400 && error.response?.status < 500) {
          console.warn(`Egreso ${egreso.id} falló por error de lógica:`, error.response?.data);
        }
      }
    }
  };

  const sincronizarTodo = useCallback(async () => {
    if (syncInProgress.current) return;
    
    const isServerUp = await checkServer();
    if (!isServerUp) return;

    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      await sincronizarVentas();
      await sincronizarEgresos();
      toast.success('Sincronización completada con éxito', {
        duration: 2000,
        position: 'bottom-right'
      });
    } catch (error) {
      console.error('Error en sincronización:', error);
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, []);

  sincronizarTodoRef.current = sincronizarTodo;

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkServer();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setServerAvailable(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    checkServer();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 px-3 py-2 rounded-lg text-sm shadow-md">
        <CloudOff className="w-4 h-4" />
        <span>Sin conexión</span>
      </div>
    );
  }

  if (serverAvailable === false) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 px-3 py-2 rounded-lg text-sm shadow-md">
        <CloudOff className="w-4 h-4" />
        <span>Servidor desconectado</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-3 py-2 rounded-lg text-sm shadow-md">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Sincronizando datos pendientes...</span>
      </div>
    );
  }

  return null;
};

export default BackgroundSync;
