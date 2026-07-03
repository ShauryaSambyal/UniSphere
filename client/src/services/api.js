import axios from 'axios';

/**
 * The resolved API base URL.
 * - In production: uses VITE_API_URL env var (e.g. https://unisphere-malg.onrender.com)
 * - In local dev: empty string, relies on Vite proxy (/api → localhost:5000)
 *
 * Export this for use in raw fetch() calls (e.g. streaming endpoints).
 */
export const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Axios instance pre-configured with the backend base URL and JWT auth header.
 * Use this for all standard (non-streaming) API calls.
 */
const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

// Attach JWT token to every request automatically
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
