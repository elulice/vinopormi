import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AuthContext = createContext(null);

import { API } from '@/lib/config';
import { handleUnauthorized } from '@/lib/api';
import { useDataRefresh } from '@/lib/dataEvents';

const INACTIVITY_MS = 60 * 60 * 1000;

// Mismo handler que la instancia de lib/api.js: cubre las llamadas que usan
// axios directo (login, /auth/me, activity check, reauth silencioso).
axios.interceptors.response.use(
  (response) => response,
  handleUnauthorized
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true);
  const inactivityTimerRef = useRef(null);
  const resetInactivityTimerRef = useRef(() => {});

  const clearAuthState = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('offline_credentials');
    setToken(null);
    setUser(null);
    setAutoLogoutEnabled(false);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // Cierre local por inactividad: NO hace requests, así los heartbeats no
  // renuevan lastActivity. El servidor sigue siendo la autoridad al validar
  // cada request autenticada.
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (!autoLogoutEnabled || !token) return;

    inactivityTimerRef.current = setTimeout(() => {
      toast.error('Tu sesión ha expirado por inactividad. Inicia sesión nuevamente.');
      clearAuthState();
      window.location.href = '/login';
    }, INACTIVITY_MS);
  }, [autoLogoutEnabled, token, clearAuthState]);

  resetInactivityTimerRef.current = resetInactivityTimer;

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
    if (!autoLogoutEnabled || !token) return;

    const handleActivity = () => resetInactivityTimerRef.current();
    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll',
      'touchstart', 'click', 'keydown', 'keyup'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });
    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [autoLogoutEnabled, token, resetInactivityTimer]);

  // remember=false evita guardar las credenciales usadas por el re-login silencioso.
  // El default es true para no cambiar el comportamiento de otros callers.
  const login = async (username, password, remember = true) => {
    const response = await axios.post(`${API}/auth/login`, { username, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    if (remember) {
      localStorage.setItem('offline_credentials', JSON.stringify({ username, password }));
    } else {
      localStorage.removeItem('offline_credentials');
    }
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
      setAutoLogoutEnabled(userData.preferencias?.autoLogout !== false);
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

  // Un cambio de preferencias o de usuario en otro tab llega por el bus y
  // actualiza el usuario actual (rol, autoLogout, etc.) sin recargar la página.
  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      setAutoLogoutEnabled(response.data.preferencias?.autoLogout !== false);
    } catch (_) {
      // El 401 ya lo maneja el interceptor global.
    }
  }, []);

  useDataRefresh(['auth', 'usuarios'], refreshUser);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      register, 
      logout: clearAuthState,
      loading, 
      getAuthHeader, 
      // El efecto de actividad arma/desarma el timer según este flag.
      updateAutoLogoutSetting: setAutoLogoutEnabled,
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
