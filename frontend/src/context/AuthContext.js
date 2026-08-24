import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AuthContext = createContext(null);

import { API } from '@/lib/config';

// Configurar interceptor global para manejar 401
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      const serverDown = localStorage.getItem('server_online') === 'false';
      if (serverDown) {
        return Promise.reject(error);
      }
      
      const errorMessage = error.response.data?.detail || 'Token inválido o expirado';
      
      if (errorMessage.includes('Sesión expirada por inactividad')) {
        toast.error('Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.');
      } else {
        toast.error('Token inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('offline_credentials');
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

  const clearAuthState = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('offline_credentials');
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
              if (error.response?.status === 401) {
                clearAuthState();
              }
            }
          }, 30 * 1000);
          
          return timer;
        });
      }
    };
  }, [autoLogoutEnabled, token, clearAuthState]);

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          setUser(response.data);
          setToken(storedToken);
          localStorage.setItem('user', JSON.stringify(response.data));
          
          const isEnabled = response.data.preferencias?.autoLogout !== false;
          setAutoLogoutEnabled(isEnabled);
        } catch (error) {
          if (!error.response) {
            if (storedUser) {
              setUser(JSON.parse(storedUser));
            }
            setToken(storedToken);
            setAutoLogoutEnabled(false);
            setLoading(false);
            return;
          }
          if (error.response.status !== 401) {
            clearAuthState();
          }
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [clearAuthState]);

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
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('offline_credentials', JSON.stringify({ username, password }));
    setToken(newToken);
    setUser(userData);
    
    const isEnabled = userData.preferencias?.autoLogout !== false;
    setAutoLogoutEnabled(isEnabled);
    
    return userData;
  };

  const silentReauth = useCallback(async () => {
    const credentials = localStorage.getItem('offline_credentials');
    if (!credentials) return false;

    try {
      const { username, password } = JSON.parse(credentials);
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      toast.success('Sesión reestablecida automáticamente', { duration: 2000 });
      return true;
    } catch (error) {
      console.warn('Re-login silencioso falló:', error);
      return false;
    }
  }, []);

  const register = async (username, password, nombre) => {
    await axios.post(`${API}/auth/register`, { username, password, nombre });
  };

  const getAuthHeader = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      register, 
      logout: clearAuthState,
      loading, 
      getAuthHeader, 
      updateAutoLogoutSetting: (enabled) => {
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
      },
      autoLogoutEnabled,
      silentReauth
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
