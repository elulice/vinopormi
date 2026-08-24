import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { API } from '@/lib/config';

const ConfigContext = createContext(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// Espejo en localStorage para todas las preferencias:
// permite render inicial sin parpadeo y sirve de caché/offline.
const MIRROR_KEYS = {
  showCents: 'vinopormi_show_cents',
  sidebarWidth: 'vinopormi_sidebar_width',
  floatingMenu: 'vinopormi_floating_menu',
  autoLogout: 'vinopormi_auto_logout',
  calcularVuelto: 'vinopormi_calcular_vuelto',
  darkMode: 'vinopormi_dark_mode'
};

const readMirror = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return typeof fallback === 'boolean' ? v === 'true' : v;
  } catch (e) {
    return fallback;
  }
};

const writeMirror = (key, value) => {
  try {
    localStorage.setItem(key, typeof value === 'boolean' ? JSON.stringify(value) : value);
  } catch (e) {
    // ignorar
  }
};

export const ConfigProvider = ({ children }) => {
  const { user, getAuthHeader, updateAutoLogoutSetting } = useAuth();
  const [showCents, setShowCentsState] = useState(() => readMirror(MIRROR_KEYS.showCents, true)); // Por defecto mostrar centavos
  const [sidebarWidth, setSidebarWidthState] = useState(() => readMirror(MIRROR_KEYS.sidebarWidth, 'normal')); // 'compact', 'normal', 'expanded'
  const [floatingMenu, setFloatingMenuState] = useState(() => readMirror(MIRROR_KEYS.floatingMenu, false)); // Por defecto deshabilitado
  const [autoLogout, setAutoLogoutState] = useState(() => readMirror(MIRROR_KEYS.autoLogout, true)); // Por defecto habilitado
  const [calcularVuelto, setCalcularVueltoState] = useState(() => readMirror(MIRROR_KEYS.calcularVuelto, true)); // Por defecto habilitado
  const [darkMode, setDarkModeState] = useState(() => readMirror(MIRROR_KEYS.darkMode, false));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Aplicar la clase 'dark' en el documento según el estado
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Cargar preferencias del usuario desde el backend
  const loadPreferences = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/preferencias`, {
        headers: getAuthHeader()
      });
      
      const preferencias = response.data;
      const showCentsVal = preferencias.showCents !== undefined ? preferencias.showCents : true;
      const sidebarWidthVal = preferencias.sidebarWidth !== undefined ? preferencias.sidebarWidth : 'normal';
      const floatingMenuVal = preferencias.floatingMenu !== undefined ? preferencias.floatingMenu : false;
      const autoLogoutVal = preferencias.autoLogout !== undefined ? preferencias.autoLogout : false;
      const calcularVueltoVal = preferencias.calcularVuelto !== undefined ? preferencias.calcularVuelto : true;
      const darkModeVal = preferencias.darkMode !== undefined ? preferencias.darkMode : false;

      setShowCentsState(showCentsVal);
      setSidebarWidthState(sidebarWidthVal);
      setFloatingMenuState(floatingMenuVal);
      setAutoLogoutState(autoLogoutVal);
      setCalcularVueltoState(calcularVueltoVal);
      setDarkModeState(darkModeVal);

      // Mantener el espejo de localStorage sincronizado con el backend
      writeMirror(MIRROR_KEYS.showCents, showCentsVal);
      writeMirror(MIRROR_KEYS.sidebarWidth, sidebarWidthVal);
      writeMirror(MIRROR_KEYS.floatingMenu, floatingMenuVal);
      writeMirror(MIRROR_KEYS.autoLogout, autoLogoutVal);
      writeMirror(MIRROR_KEYS.calcularVuelto, calcularVueltoVal);
      writeMirror(MIRROR_KEYS.darkMode, darkModeVal);
    } catch (err) {
      console.error('Error cargando preferencias:', err);
      // En caso de error, usar valor por defecto
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeader]);

  // Persistir una preferencia en el backend (best-effort)
  const savePref = async (payload) => {
    if (!user) return;
    try {
      await axios.put(`${API}/auth/preferencias`, payload, { headers: getAuthHeader() });
      setError(null);
    } catch (err) {
      console.error('Error guardando preferencia:', err);
      setError(err);
    }
  };

  // Guardar preferencias en el backend (y espejo en localStorage)
  const setShowCents = async (show) => {
    setShowCentsState(show);
    writeMirror(MIRROR_KEYS.showCents, show);
    await savePref({ showCents: show });
  };

  const setSidebarWidth = async (width) => {
    setSidebarWidthState(width);
    writeMirror(MIRROR_KEYS.sidebarWidth, width);
    await savePref({ sidebarWidth: width });
  };

  const setFloatingMenu = async (enabled) => {
    setFloatingMenuState(enabled);
    writeMirror(MIRROR_KEYS.floatingMenu, enabled);
    await savePref({ floatingMenu: enabled });
  };

  const setAutoLogout = async (enabled) => {
    setAutoLogoutState(enabled);
    writeMirror(MIRROR_KEYS.autoLogout, enabled);
    updateAutoLogoutSetting(enabled);
    await savePref({ autoLogout: enabled });
  };

  const setCalcularVuelto = async (enabled) => {
    setCalcularVueltoState(enabled);
    writeMirror(MIRROR_KEYS.calcularVuelto, enabled);
    await savePref({ calcularVuelto: enabled });
  };

  const toggleShowCents = () => {
    setShowCents(!showCents);
  };

  // Guardar darkMode en el backend (y espejo en localStorage)
  const setDarkMode = async (enabled) => {
    setDarkModeState(enabled);
    writeMirror(MIRROR_KEYS.darkMode, enabled);
    await savePref({ darkMode: enabled });
  };

  // Cargar preferencias cuando el usuario cambia
  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      // Resetear cuando no hay usuario
      setShowCentsState(true);
      setSidebarWidthState('normal');
      setFloatingMenuState(false);
      setAutoLogoutState(false);
      setCalcularVueltoState(true);
      setDarkModeState(false);
      setLoading(false);
    }
  }, [user, loadPreferences]);

  return (
    <ConfigContext.Provider value={{
      showCents,
      setShowCents,
      toggleShowCents,
      sidebarWidth,
      setSidebarWidth,
      floatingMenu,
      setFloatingMenu,
      autoLogout,
      setAutoLogout,
      calcularVuelto,
      setCalcularVuelto,
      darkMode,
      setDarkMode,
      loading,
      error
    }}>
      {children}
    </ConfigContext.Provider>
  );
};