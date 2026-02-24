import axios from 'axios';
import { API } from './config';

const getToken = () => localStorage.getItem('token');

const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const api = axios.create({
  baseURL: API,
});

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
