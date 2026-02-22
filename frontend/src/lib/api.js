import axios from 'axios';
import { API } from './config';

const api = axios.create({
  baseURL: API,
});

export const setAuthHeader = (header) => {
  api.defaults.headers.common = {
    ...api.defaults.headers.common,
    ...header,
  };
};

export const clearAuthHeader = () => {
  delete api.defaults.headers.common['Authorization'];
};

export const apiGet = async (url, authHeader = {}) => {
  return api.get(url, { headers: authHeader });
};

export const apiPost = async (url, data, authHeader = {}) => {
  return api.post(url, data, { headers: authHeader });
};

export const apiPut = async (url, data, authHeader = {}) => {
  return api.put(url, data, { headers: authHeader });
};

export const apiDelete = async (url, authHeader = {}) => {
  return api.delete(url, { headers: authHeader });
};

export default api;
