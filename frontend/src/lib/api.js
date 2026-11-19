import axios from 'axios';
import { toast } from 'sonner';
import { API } from './config';

const getToken = () => localStorage.getItem('token');

// Handler 401 centralizado: se registra en esta instancia (la usan casi todas
// las pantallas vía apiGet/apiPost/...) y también lo reutiliza AuthContext para
// el axios global. Así un token vencido cierra sesión sin importar el helper usado.
// OJO: si server_online === 'false' estamos reconectando; BackgroundSync se
// encarga de la reautenticación silenciosa y NO debemos hacer logout acá.
export const handleUnauthorized = (error) => {
  if (!error.response || error.response?.status !== 401) {
    return Promise.reject(error);
  }

  if (localStorage.getItem('server_online') === 'false') {
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
};

const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const api = axios.create({
  baseURL: API,
});

api.interceptors.response.use((response) => response, handleUnauthorized);

export const apiGet = async (url, config = {}) => {
  return api.get(url, { ...config, headers: { ...getAuthHeader(), ...config.headers } });
};

export const apiGetPublic = async (url, config = {}) => {
  return api.get(url, { ...config, headers: { ...config.headers } });
};

export const apiPost = async (url, data, config = {}) => {
  return api.post(url, data, { ...config, headers: { ...getAuthHeader(), ...config.headers } });
};

export const apiPut = async (url, data, config = {}) => {
  return api.put(url, data, { ...config, headers: { ...getAuthHeader(), ...config.headers } });
};

export const apiDelete = async (url, config = {}) => {
  return api.delete(url, { ...config, headers: { ...getAuthHeader(), ...config.headers } });
};

export const setAuthHeader = (header) => {
  api.defaults.headers.common = {
    ...api.defaults.headers.common,
    ...header,
  };
};

export const clearAuthHeader = () => {
  delete api.defaults.headers.common['Authorization'];
};

export default api;
