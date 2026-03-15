import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import {
  Activity, Droplets, Thermometer, Wind,
  CloudRain, Leaf, TrendingUp, AlertTriangle, Sun
} from 'lucide-react';
import { getIndices, getCurrentWeather, getTimeseries } from '../utils/api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Default demo coordinates (Punjab, India)
const DEFAULT_LAT = 30.9;
const DEFAULT_LON = 75.85;

function getZoneClass(zone) {
  if (!zone) return '';
  return `zone-${zone.toLowerCase()}`;
}

function getZoneColor(zone) {
  const colors = {
    'Critical': '#ef5350', 'Poor': '#ff7043', 'Moderate': '#ffb300',
    'Good': '#66bb6a', 'Excellent': '#26a69a',
  };
  return colors[zone] || '#6b8a72';
}

export default function Dashboard() {
  const [indices, setIndices] = useState(null);
  const [weather, setWeather] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lat = DEFAULT_LAT;
  const lon = DEFAULT_LON;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

      try {
        const [indicesRes, tsRes] = await Promise.allSettled([
          getIndices(lat, lon, start, end),
          getTimeseries(lat, lon, start, end),
        ]);

        if (indicesRes.status === 'fulfilled') setIndices(indicesRes.value.data);
        if (tsRes.status === 'fulfilled') setTimeseries(tsRes.value.data.points || []);
      } catch (e) {
        setError('Failed to load satellite data. Is the backend running?');
      }

      try {
        const weatherRes = await getCurrentWeather(lat, lon);
        setWeather(weatherRes.data);
      } catch {
        // Weather is optional
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <p>Fetching satellite data from Google Earth Engine…</p>
      </div>
    );
  }

  const indexList = indices?.indices
    ? Object.entries(indices.indices).map(([key, val]) => ({ key, ...val }))
    : [];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Real-time crop health overview — Punjab, India ({lat}°N, {lon}°E)</p>
      </div>

      {error && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-amber)' }}>
          <div className="flex items-center gap-8">
            <AlertTriangle size={18} color="var(--accent-amber)" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ── Weather Strip ───────────────────────────────────────────────── */}
      {weather && (
        <div className="card mb-24 animate-in" style={{ padding: '14px 20px' }}>
          <div className="flex items-center gap-24" style={{ flexWrap: 'wrap' }}>
            <div className="flex items-center gap-8">
              <Sun size={18} color="var(--accent-amber)" />
              <span className="font-bold">{weather.description}</span>
            </div>
            <div className="flex items-center gap-8">
              <Thermometer size={16} color="var(--accent-orange)" />
              <span>{weather.temp_c}°C</span>
            </div>
            <div className="flex items-center gap-8">
              <Droplets size={16} color="var(--accent-cyan)" />
              <span>{weather.humidity_pct}% RH</span>
            </div>
            <div className="flex items-center gap-8">
              <Wind size={16} color="var(--text-muted)" />
              <span>{weather.wind_kph} km/h</span>
            </div>
            <div className="flex items-center gap-8">
              <CloudRain size={16} color="var(--accent-cyan)" />
              <span>{weather.rainfall_mm} mm</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Vegetation Index Cards ─────────────────────────────────────── */}
      <div className="grid-4 mb-24">
        {indexList.map((idx, i) => (
          <div
            key={idx.key}
            className={`card index-card animate-in animate-in-delay-${i % 4}`}
          >
            <div className="index-label">{idx.key}</div>
            <div
              className="index-value"
              style={{ color: getZoneColor(idx.health_zone) }}
            >
              {idx.value !== null ? idx.value.toFixed(3) : '—'}
            </div>
            <div className={`index-zone ${getZoneClass(idx.health_zone)}`}>
              {idx.health_zone || 'Unknown'}
            </div>
            <div className="text-xs text-muted mt-8">{idx.description}</div>
          </div>
        ))}
      </div>

      {/* ── Map + Timeseries ───────────────────────────────────────────── */}
      <div className="grid-2 mb-24">
        {/* Map */}
        <div className="card animate-in animate-in-delay-1">
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} /> Field Location
            </div>
            <span className="badge badge-green">Live</span>
          </div>
          <div className="map-container">
            <MapContainer center={[lat, lon]} zoom={12} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OSM'
              />
              <Marker position={[lat, lon]}>
                <Popup>
                  <strong>Demo Field</strong><br />
                  {lat}°N, {lon}°E<br />
                  NDVI: {indices?.indices?.NDVI?.value?.toFixed(3) || '—'}
                </Popup>
              </Marker>
              <Circle
                center={[lat, lon]}
                radius={1000}
                pathOptions={{
                  color: getZoneColor(indices?.indices?.NDVI?.health_zone),
                  fillColor: getZoneColor(indices?.indices?.NDVI?.health_zone),
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
            </MapContainer>
          </div>
        </div>

        {/* Timeseries Chart */}
        <div className="card animate-in animate-in-delay-2">
          <div className="card-header">
            <div className="card-title">
              <TrendingUp size={18} /> Vegetation Trend (90 Days)
            </div>
          </div>
          <div className="chart-container">
            {timeseries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries}>
                  <defs>
                    <linearGradient id="gNDVI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#66bb6a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#66bb6a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gEVI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#26c6da" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#26c6da" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d) => d?.slice(5)}
                  />
                  <YAxis domain={[-0.2, 1]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#161f1b',
                      border: '1px solid rgba(76,175,80,0.2)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone" dataKey="ndvi" name="NDVI"
                    stroke="#66bb6a" fill="url(#gNDVI)" strokeWidth={2}
                  />
                  <Area
                    type="monotone" dataKey="evi" name="EVI"
                    stroke="#26c6da" fill="url(#gEVI)" strokeWidth={2}
                  />
                  <Line
                    type="monotone" dataKey="ndwi" name="NDWI"
                    stroke="#ffb300" strokeWidth={1.5} dot={false}
                  />
                  <Line
                    type="monotone" dataKey="ndre" name="NDRE"
                    stroke="#ab47bc" strokeWidth={1.5} dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="loading-overlay">
                <p>No time series data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Stats ────────────────────────────────────────────────── */}
      {indices && (
        <div className="grid-3">
          <div className="card animate-in animate-in-delay-3">
            <div className="card-title mb-16"><Leaf size={18} /> Crop Summary</div>
            <div className="stat-row">
              <div className="stat-icon" style={{ background: 'rgba(76,175,80,0.12)' }}>
                <Activity size={18} color="var(--green-400)" />
              </div>
              <div className="stat-info">
                <div className="label">Overall Health</div>
                <div className="value">{indices.indices?.NDVI?.health_zone || '—'}</div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-icon" style={{ background: 'rgba(38,198,218,0.12)' }}>
                <Droplets size={18} color="var(--accent-cyan)" />
              </div>
              <div className="stat-info">
                <div className="label">Water Status</div>
                <div className="value">{indices.indices?.NDWI?.health_zone || '—'}</div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-icon" style={{ background: 'rgba(255,179,0,0.12)' }}>
                <Sun size={18} color="var(--accent-amber)" />
              </div>
              <div className="stat-info">
                <div className="label">Soil Exposure</div>
                <div className="value">{indices.indices?.BSI?.health_zone || '—'}</div>
              </div>
            </div>
          </div>

          <div className="card animate-in animate-in-delay-3">
            <div className="card-title mb-16"><Activity size={18} /> Satellite Info</div>
            <div className="stat-row">
              <div className="stat-info">
                <div className="label">Images Processed</div>
                <div className="value">{indices.image_count}</div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-info">
                <div className="label">Source</div>
                <div className="value">Sentinel-2 SR</div>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-info">
                <div className="label">Resolution</div>
                <div className="value">10m/px</div>
              </div>
            </div>
          </div>

          <div className="card animate-in animate-in-delay-4">
            <div className="card-title mb-16"><AlertTriangle size={18} /> Active Alerts</div>
            <div className="loading-overlay" style={{ padding: '20px' }}>
              <p className="text-muted">No active alerts</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
