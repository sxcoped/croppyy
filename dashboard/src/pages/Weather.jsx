import { useState, useEffect } from 'react';
import { CloudSun, Thermometer, Droplets, Wind, CloudRain, Loader } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { getCurrentWeather, getForecast } from '../utils/api';

export default function Weather() {
  const [lat, setLat] = useState('30.9');
  const [lon, setLon] = useState('75.85');
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchWeather() {
    setLoading(true);
    try {
      const [curRes, fcRes] = await Promise.allSettled([
        getCurrentWeather(parseFloat(lat), parseFloat(lon)),
        getForecast(parseFloat(lat), parseFloat(lon)),
      ]);
      if (curRes.status === 'fulfilled') setCurrent(curRes.data);
      if (fcRes.status === 'fulfilled') setForecast(fcRes.data || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchWeather(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Weather</h1>
        <p>Real-time weather data from OpenWeatherMap + NASA POWER</p>
      </div>

      {/* Location selector */}
      <div className="card mb-24">
        <div className="flex gap-16 items-center" style={{ flexWrap: 'wrap' }}>
          <div>
            <label>Latitude</label>
            <input className="input" value={lat} onChange={e => setLat(e.target.value)} style={{ width: 120 }} />
          </div>
          <div>
            <label>Longitude</label>
            <input className="input" value={lon} onChange={e => setLon(e.target.value)} style={{ width: 120 }} />
          </div>
          <button className="btn btn-primary" onClick={fetchWeather} disabled={loading} style={{ alignSelf: 'flex-end' }}>
            {loading ? <Loader size={16} /> : <CloudSun size={16} />}
            {loading ? 'Loading…' : 'Get Weather'}
          </button>
        </div>
      </div>

      {/* Current weather */}
      {current && !current.error && (
        <div className="grid-4 mb-24">
          <div className="card animate-in" style={{ textAlign: 'center' }}>
            <Thermometer size={28} color="var(--accent-orange)" />
            <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 8 }}>{current.temp_c}°C</div>
            <div className="text-xs text-muted">Temperature</div>
          </div>
          <div className="card animate-in animate-in-delay-1" style={{ textAlign: 'center' }}>
            <Droplets size={28} color="var(--accent-cyan)" />
            <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 8 }}>{current.humidity_pct}%</div>
            <div className="text-xs text-muted">Humidity</div>
          </div>
          <div className="card animate-in animate-in-delay-2" style={{ textAlign: 'center' }}>
            <Wind size={28} color="var(--text-secondary)" />
            <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 8 }}>{current.wind_kph}</div>
            <div className="text-xs text-muted">Wind (km/h)</div>
          </div>
          <div className="card animate-in animate-in-delay-3" style={{ textAlign: 'center' }}>
            <CloudRain size={28} color="var(--accent-cyan)" />
            <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 8 }}>{current.rainfall_mm}</div>
            <div className="text-xs text-muted">Rainfall (mm/hr)</div>
          </div>
        </div>
      )}

      {current?.error && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent-amber)' }}>
          <p style={{ color: 'var(--accent-amber)' }}>⚠️ {current.error}</p>
        </div>
      )}

      {/* 5-Day Forecast */}
      {forecast.length > 0 && (
        <div className="grid-2">
          <div className="card animate-in animate-in-delay-2">
            <div className="card-title mb-16">🌤 5-Day Temperature Forecast</div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#161f1b', border: '1px solid rgba(76,175,80,0.2)',
                      borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="temp_max" name="Max Temp" fill="#ff7043" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="temp_min" name="Min Temp" fill="#26c6da" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card animate-in animate-in-delay-3">
            <div className="card-title mb-16">💧 Rainfall & Humidity Forecast</div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#161f1b', border: '1px solid rgba(76,175,80,0.2)',
                      borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="rainfall_mm" name="Rainfall (mm)" stroke="#26c6da" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#ab47bc" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
