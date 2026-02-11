import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const ConfigContext = createContext(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

export const ConfigProvider = ({ children }) => {
  const { user, getAuthHeader, updateAutoLogoutSetting } = useAuth();
  const [showCents, setShowCentsState] = useState(true); // Por defecto mostrar centavos
  const [sidebarWidth, setSidebarWidthState] = useState('normal'); // 'compact', 'normal', 'expanded'
  const [floatingMenu, setFloatingMenuState] = useState(false); // Por defecto deshabilitado
  const [autoLogout, setAutoLogoutState] = useState(true); // Por defecto habilitado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar preferencias del usuario desde el backend
  const loadPreferences = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      const response = await axios.get(`${BACKEND_URL}/api/auth/preferencias`, {
        headers: getAuthHeader()
      });
      
      const preferencias = response.data;
      setShowCentsState(preferencias.showCents !== undefined ? preferencias.showCents : true);
      setSidebarWidthState(preferencias.sidebarWidth !== undefined ? preferencias.sidebarWidth : 'normal');
      setFloatingMenuState(preferencias.floatingMenu !== undefined ? preferencias.floatingMenu : false);
      setAutoLogoutState(preferencias.autoLogout !== undefined ? preferencias.autoLogout : false);
    } catch (err) {
      console.error('Error cargando preferencias:', err);
      // En caso de error, usar valor por defecto
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeader]);

  // Guardar preferencias en el backend
  const setShowCents = async (show) => {
    if (!user) return;

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      await axios.put(`${BACKEND_URL}/api/auth/preferencias`, 
        { showCents: show },
        { headers: getAuthHeader() }
      );
      
      setShowCentsState(show);
      setError(null);
    } catch (err) {
      console.error('Error guardando preferencias:', err);
      setError(err);
      // Guardar temporalmente en localStorage como fallback
      localStorage.setItem('vinopormi_show_cents_fallback', JSON.stringify(show));
    }
  };

  // Guardar sidebarWidth en el backend
  const setSidebarWidth = async (width) => {
    if (!user) return;

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      await axios.put(`${BACKEND_URL}/api/auth/preferencias`, 
        { sidebarWidth: width },
        { headers: getAuthHeader() }
      );
      
      setSidebarWidthState(width);
      setError(null);
    } catch (err) {
      console.error('Error guardando preferencias:', err);
      setError(err);
      // Guardar temporalmente en localStorage como fallback
      localStorage.setItem('vinopormi_sidebar_width_fallback', JSON.stringify(width));
    }
  };

  // Guardar floatingMenu en el backend
  const setFloatingMenu = async (enabled) => {
    if (!user) return;

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      await axios.put(`${BACKEND_URL}/api/auth/preferencias`, 
        { floatingMenu: enabled },
        { headers: getAuthHeader() }
      );
      
      setFloatingMenuState(enabled);
      setError(null);
    } catch (err) {
      console.error('Error guardando preferencias:', err);
      setError(err);
      // Guardar temporalmente en localStorage como fallback
      localStorage.setItem('vinopormi_floating_menu_fallback', JSON.stringify(enabled));
    }
  };

  // Guardar autoLogout en el backend
  const setAutoLogout = async (enabled) => {
    if (!user) return;

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      await axios.put(`${BACKEND_URL}/api/auth/preferencias`, 
        { autoLogout: enabled },
        { headers: getAuthHeader() }
      );
      
      setAutoLogoutState(enabled);
      // Actualizar el contexto de autenticación
      updateAutoLogoutSetting(enabled);
      setError(null);
    } catch (err) {
      console.error('Error guardando preferencias:', err);
      setError(err);
      // Guardar temporalmente en localStorage como fallback
      localStorage.setItem('vinopormi_auto_logout_fallback', JSON.stringify(enabled));
    }
  };

  const toggleShowCents = () => {
    setShowCents(!showCents);
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
      loading,
      error
    }}>
      {children}
    </ConfigContext.Provider>
  );
};