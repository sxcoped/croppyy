/**
 * Croppy API Client
 * Axios instance that auto-injects the Supabase JWT on every request.
 */
import axios from 'axios';
import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_URL });

// ── Request interceptor — inject Bearer token ───────────────────────
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return config;
});

// ── Response interceptor — token expiry handling ────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) {
        // Retry the original request
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          error.config.headers['Authorization'] = `Bearer ${session.access_token}`;
          return api.request(error.config);
        }
      }
      // If refresh failed, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ══════════════════════════════════════════════════════════════════════
// API Functions
// ══════════════════════════════════════════════════════════════════════

// ── Remote Sensing ────────────────────────────────────────────────────
export const getIndices = (lat, lon, start, end, fieldId = null) =>
  api.post('/api/rs/indices' + (fieldId ? `?field_id=${fieldId}` : ''), { lat, lon, start, end, buffer_m: 1000, cloud_pct: 20 });

export const getTimeseries = (lat, lon, start, end) =>
  api.post('/api/rs/timeseries', { lat, lon, start, end, buffer_m: 1000, cloud_pct: 20 });

export const getSoilMoisture = (lat, lon, start, end) =>
  api.post('/api/rs/soil-moisture', { lat, lon, start, end });

export const getFieldHistory = (fieldId, limit = 30) =>
  api.get(`/api/rs/history/${fieldId}?limit=${limit}`);

// ── ML ────────────────────────────────────────────────────────────────
export const detectDisease = (imageFile) => {
  const form = new FormData();
  form.append('file', imageFile);
  return api.post('/api/ml/detect-disease', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const getPestRisk = (params) =>
  api.post('/api/ml/pest-risk', params);

export const getStressForecast = (sequence, fieldId = null) =>
  api.post('/api/ml/stress-forecast', { sequence, field_id: fieldId });

export const getYieldEstimate = (params) =>
  api.post('/api/ml/yield-estimate', params);

// ── Fields ────────────────────────────────────────────────────────────
export const listFields  = ()         => api.get('/api/fields');
export const createField = (data)     => api.post('/api/fields', data);
export const getField    = (id)       => api.get(`/api/fields/${id}`);
export const updateField = (id, data) => api.put(`/api/fields/${id}`, data);
export const deleteField = (id)       => api.delete(`/api/fields/${id}`);

// ── Sensors ──────────────────────────────────────────────────────────
export const ingestSensor    = (data)          => api.post('/api/sensors/ingest', data);
export const getSensorLatest = (fieldId)       => api.get(`/api/sensors/${fieldId}/latest`);
export const getSensorHistory= (fieldId, n=50) => api.get(`/api/sensors/${fieldId}/history?limit=${n}`);

// ── Weather ──────────────────────────────────────────────────────────
export const getCurrentWeather  = (lat, lon) => api.get(`/api/weather/current?lat=${lat}&lon=${lon}`);
export const getForecast        = (lat, lon) => api.get(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
export const getHistoricalWeather=(lat, lon, start, end) =>
  api.get(`/api/weather/historical?lat=${lat}&lon=${lon}&start=${start}&end=${end}`);

// ── Alerts ───────────────────────────────────────────────────────────
export const getAlerts        = (unackOnly=false) => api.get(`/api/alerts${unackOnly ? '?unacknowledged_only=true' : ''}`);
export const getAlertSummary  = ()                => api.get('/api/alerts/summary');
export const createAlert      = (data)            => api.post('/api/alerts', data);
export const acknowledgeAlert = (id)              => api.put(`/api/alerts/${id}/acknowledge`);
export const deleteAlert      = (id)              => api.delete(`/api/alerts/${id}`);

// ── Market ───────────────────────────────────────────────────────────
export const getMarketPrices = (crop, state='') =>
  api.get(`/api/market/prices?crop=${crop}${state ? `&state=${state}` : ''}`);

// ── Reports ──────────────────────────────────────────────────────────
export const generateReport  = (data) => api.post('/api/reports/generate', data, { responseType: 'blob' });

// ── Auth (via FastAPI — profile management) ───────────────────────────
export const getMe           = ()     => api.get('/api/auth/me');
export const updateMyProfile = (data) => api.put('/api/auth/profile', data);

export default api;
