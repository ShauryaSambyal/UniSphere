import axios from 'axios';

const PRODUCTION_API_URL = 'https://unisphere-malg.onrender.com';

export const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PRODUCTION_API_URL : '')
).replace(/\/+$/, '');

const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
