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
  darkMode: 'vinopormi_dark_mode',
  totalFlotante: 'vinopormi_total_flotante'
};

// Valores por defecto según la fuente: espejo local (primer render) y backend (usuario logueado)
const MIRROR_DEFAULTS = {
  showCents: true,
  sidebarWidth: 'normal',
  floatingMenu: false,
  autoLogout: true,
  calcularVuelto: true,
  darkMode: true,
  totalFlotante: false
};

const BACKEND_DEFAULTS = {
  showCents: true,
  sidebarWidth: 'normal',
  floatingMenu: false,
  autoLogout: false,
  calcularVuelto: true,
  darkMode: false,
  totalFlotante: false
};

const PREF_KEYS = ['showCents', 'sidebarWidth', 'floatingMenu', 'autoLogout', 'calcularVuelto', 'darkMode', 'totalFlotante'];

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

export const ConfigProvider = ({ children, forceDark = false }) => {
  const { user, getAuthHeader, updateAutoLogoutSetting } = useAuth();
  const [showCents, setShowCentsState] = useState(() => readMirror(MIRROR_KEYS.showCents, MIRROR_DEFAULTS.showCents));
  const [sidebarWidth, setSidebarWidthState] = useState(() => readMirror(MIRROR_KEYS.sidebarWidth, MIRROR_DEFAULTS.sidebarWidth));
  const [floatingMenu, setFloatingMenuState] = useState(() => readMirror(MIRROR_KEYS.floatingMenu, MIRROR_DEFAULTS.floatingMenu));
  const [autoLogout, setAutoLogoutState] = useState(() => readMirror(MIRROR_KEYS.autoLogout, MIRROR_DEFAULTS.autoLogout));
  const [calcularVuelto, setCalcularVueltoState] = useState(() => readMirror(MIRROR_KEYS.calcularVuelto, MIRROR_DEFAULTS.calcularVuelto));
  const [darkMode, setDarkModeState] = useState(() => forceDark ? true : readMirror(MIRROR_KEYS.darkMode, MIRROR_DEFAULTS.darkMode));
  const [totalFlotante, setTotalFlotanteState] = useState(() => readMirror(MIRROR_KEYS.totalFlotante, MIRROR_DEFAULTS.totalFlotante));
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
      const valores = {};
      for (const key of PREF_KEYS) {
        let valor = preferencias[key] !== undefined ? preferencias[key] : BACKEND_DEFAULTS[key];
        if (key === 'darkMode') valor = forceDark ? true : valor;
        valores[key] = valor;
        writeMirror(MIRROR_KEYS[key], valor);
      }

      setShowCentsState(valores.showCents);
      setSidebarWidthState(valores.sidebarWidth);
      setFloatingMenuState(valores.floatingMenu);
      setAutoLogoutState(valores.autoLogout);
      setCalcularVueltoState(valores.calcularVuelto);
      setDarkModeState(valores.darkMode);
      setTotalFlotanteState(valores.totalFlotante);
    } catch (err) {
      console.error('Error cargando preferencias:', err);
      // En caso de error, usar valor por defecto
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeader, forceDark]);

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

  // Fábrica de setters: actualiza estado + espejo local + backend en un solo lugar
  const makeSetter = (key, setState, extra = null) => async (value) => {
    setState(value);
    writeMirror(MIRROR_KEYS[key], value);
    if (extra) extra(value);
    await savePref({ [key]: value });
  };

  const setShowCents = makeSetter('showCents', setShowCentsState);
  const setSidebarWidth = makeSetter('sidebarWidth', setSidebarWidthState);
  const setFloatingMenu = makeSetter('floatingMenu', setFloatingMenuState);
  const setAutoLogout = makeSetter('autoLogout', setAutoLogoutState, updateAutoLogoutSetting);
  const setCalcularVuelto = makeSetter('calcularVuelto', setCalcularVueltoState);
  const setDarkMode = makeSetter('darkMode', setDarkModeState);
  const setTotalFlotante = makeSetter('totalFlotante', setTotalFlotanteState);

  const toggleShowCents = () => {
    setShowCents(!showCents);
  };

  // Cargar preferencias cuando el usuario cambia
  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      // Resetear cuando no hay usuario (darkMode se conserva desde el espejo)
      setShowCentsState(true);
      setSidebarWidthState('normal');
      setFloatingMenuState(false);
      setAutoLogoutState(false);
      setCalcularVueltoState(true);
      setTotalFlotanteState(false);
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
      totalFlotante,
      setTotalFlotante,
      loading,
      error
    }}>
      {children}
    </ConfigContext.Provider>
  );
};