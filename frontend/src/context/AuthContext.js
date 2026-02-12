import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configurar interceptor global para manejar 401
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const errorMessage = error.response.data?.detail || 'Token inválido o expirado';
      
      // Mostrar mensaje específico si es por inactividad
      if (errorMessage.includes('Sesión expirada por inactividad')) {
        toast.error('Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.');
      } else {
        toast.error('Token inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      
      // Limpiar token y estado
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [activityTimer, setActivityTimer] = useState(null);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true);

  const handleAutoLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setAutoLogoutEnabled(false);
    setActivityTimer(prevTimer => {
      if (prevTimer) {
        clearTimeout(prevTimer);
      }
      return null;
    });
  }, []);

  // Simplificar updateActivity sin useCallback para evitar ciclos
  const updateActivityRef = useRef(() => {});
  
  useEffect(() => {
    updateActivityRef.current = () => {
      if (autoLogoutEnabled && token) {
        setActivityTimer(prevTimer => {
          if (prevTimer) {
            clearTimeout(prevTimer);
          }
          
          const timer = setTimeout(async () => {
            try {
              await axios.get(`${API}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
              });
            } catch (error) {
              // El interceptor global manejará el 401, pero mantenemos el auto-logout por consistencia
              if (error.response?.status === 401) {
                handleAutoLogout();
              }
            }
          }, 30 * 1000);
          
          return timer;
        });
      }
    };
  }, [autoLogoutEnabled, token, handleAutoLogout]);

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          setUser(response.data);
          setToken(storedToken);
          
          const isEnabled = response.data.preferencias?.autoLogout !== false;
          setAutoLogoutEnabled(isEnabled);
        } catch (error) {
          // El interceptor global manejará el 401, así que solo limpiamos estado localmente
          if (!error.response || error.response.status !== 401) {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, []);

  // Efecto para detectar actividad del usuario - simplificado
  useEffect(() => {
    if (!autoLogoutEnabled) return;

    let debounceTimer = null;

    const handleActivity = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(() => {
        updateActivityRef.current();
      }, 1000);
    };

    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 
      'touchstart', 'click', 'keydown', 'keyup'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      setActivityTimer(prevTimer => {
        if (prevTimer) {
          clearTimeout(prevTimer);
        }
        return null;
      });
    };
  }, [autoLogoutEnabled]);

  const login = async (username, password) => {
    const response = await axios.post(`${API}/auth/login`, { username, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    
    const isEnabled = userData.preferencias?.autoLogout !== false;
    setAutoLogoutEnabled(isEnabled);
    
    return userData;
  };

  const register = async (username, password, nombre) => {
    await axios.post(`${API}/auth/register`, { username, password, nombre });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setAutoLogoutEnabled(false);
    setActivityTimer(prevTimer => {
      if (prevTimer) {
        clearTimeout(prevTimer);
      }
      return null;
    });
  };

  const updateAutoLogoutSetting = (enabled) => {
    setAutoLogoutEnabled(enabled);
    if (enabled) {
      updateActivityRef.current();
    } else {
      setActivityTimer(prevTimer => {
        if (prevTimer) {
          clearTimeout(prevTimer);
        }
        return null;
      });
    }
  };

  const getAuthHeader = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      register, 
      logout, 
      loading, 
      getAuthHeader, 
      updateAutoLogoutSetting,
      autoLogoutEnabled 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};