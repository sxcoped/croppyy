/**
 * Croppy API Client
 * Axios instance that auto-injects the Supabase JWT on every request.
 */
import axios from 'axios';
import { supabase, cachedAccessToken } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_URL });

// ── Request interceptor — inject Bearer token ───────────────────────
// Uses the module-level cachedAccessToken which is kept in sync by
// supabase.auth.onAuthStateChange — avoids the getSession() async
// race that was causing the token to be missing on first load.
api.interceptors.request.use(async (config) => {
  // Use cached token first (synchronous, always up-to-date)
  let token = cachedAccessToken;

  // Fallback: try getSession in case the cache hasn't been seeded yet
  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token ?? null;
  }

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — token expiry / missing auth handling ─────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const isAuthError = status === 401 || status === 403;

    if (!isAuthError) return Promise.reject(error);
    if (sessionStorage.getItem('croppy_demo') === '1') return Promise.reject(error);
    // Prevent infinite retry loop
    if (error.config._authRetried) return Promise.reject(error);

    // Try to refresh the session once
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) {
      error.config._authRetried = true;
      error.config.headers['Authorization'] = `Bearer ${refreshed.session.access_token}`;
      return api.request(error.config);
    }

    // Let Supabase's onAuthStateChange handle real sign-outs naturally
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

export const getRainfall = (lat, lon, start, end, polygon = null) =>
  api.post('/api/rs/rainfall', { lat, lon, start, end, polygon });

export const getLandSurfaceTemp = (lat, lon, start, end, polygon = null) =>
  api.post('/api/rs/land-surface-temp', { lat, lon, start, end, polygon });

export const getTopography = (lat, lon, polygon = null) =>
  api.post('/api/rs/topography', { lat, lon, polygon });

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

// ── Insurance ─────────────────────────────────────────────────────────
export const checkFasalEligibility = (data) => api.post('/api/insurance/fasal-check', data);
export const generateFarmRecord    = (data) => api.post('/api/insurance/farm-record', data, { responseType: 'blob' });
export const getFieldRecord        = (fieldId) => api.get(`/api/insurance/field-record/${fieldId}`);

// ── Zone Map & Thumbnail ──────────────────────────────────────────────
export const getZoneMap = (lat, lon, start, end, polygon = null) =>
  api.post('/api/rs/zone-map', { lat, lon, start, end, polygon });

export const getThumbnail = (lat, lon, start, end, polygon = null) =>
  api.post('/api/rs/thumbnail', { lat, lon, start, end, polygon });

export const getIndexThumbnail = (lat, lon, start, end, index, polygon = null) =>
  api.post('/api/rs/index-thumbnail', { lat, lon, start, end, index, polygon });

// ── Advisory Engine ───────────────────────────────────────────────────
export const getAdvisory = (data) => api.post('/api/advisory', data);
export const getAdvisoryCrops = () => api.get('/api/advisory/crops');
export const getGrowthStage = (crop_type, sowing_date) =>
  api.get(`/api/advisory/stage/${crop_type}?sowing_date=${sowing_date}`);
export const getFertilizerRecs = (crop_type, soil_ph = null) =>
  api.get(`/api/advisory/fertilizer/${crop_type}${soil_ph ? `?soil_ph=${soil_ph}` : ''}`);

// ── Onboarding ────────────────────────────────────────────────────────
export const analyzeOnboarding = (lat, lon, crop_type, polygon = null, buffer_m = 500) =>
  api.post('/api/onboarding/analyze', { lat, lon, crop_type, polygon, buffer_m });

// ── Auth (via FastAPI — profile management) ───────────────────────────
export const getMe           = ()     => api.get('/api/auth/me');
export const updateMyProfile = (data) => api.put('/api/auth/profile', data);

export default api;
