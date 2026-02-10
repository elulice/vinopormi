import { createContext, useContext, useState, useEffect } from 'react';
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
  const { user, getAuthHeader } = useAuth();
  const [showCents, setShowCentsState] = useState(true); // Por defecto mostrar centavos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar preferencias del usuario desde el backend
  const loadPreferences = async () => {
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
    } catch (err) {
      console.error('Error cargando preferencias:', err);
      // En caso de error, usar valor por defecto
      setError(err);
    } finally {
      setLoading(false);
    }
  };

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
      setLoading(false);
    }
  }, [user]);

  return (
    <ConfigContext.Provider value={{
      showCents,
      setShowCents,
      toggleShowCents,
      loading,
      error
    }}>
      {children}
    </ConfigContext.Provider>
  );
};