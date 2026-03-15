import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { TrendingUp, Search, Loader } from 'lucide-react';
import { getIndices, getTimeseries, getSoilMoisture } from '../utils/api';

function getZoneColor(zone) {
  const c = { Critical: '#ef5350', Poor: '#ff7043', Moderate: '#ffb300', Good: '#66bb6a', Excellent: '#26a69a' };
  return c[zone] || '#6b8a72';
}

export default function FieldHealth() {
  const [lat, setLat] = useState('30.9');
  const [lon, setLon] = useState('75.85');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 90 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [indices, setIndices] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [soilMoisture, setSoilMoisture] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      const [idxRes, tsRes, smRes] = await Promise.allSettled([
        getIndices(parseFloat(lat), parseFloat(lon), startDate, endDate),
        getTimeseries(parseFloat(lat), parseFloat(lon), startDate, endDate),
        getSoilMoisture(parseFloat(lat), parseFloat(lon), startDate, endDate),
      ]);
      if (idxRes.status === 'fulfilled') setIndices(idxRes.value.data);
      if (tsRes.status === 'fulfilled') setTimeseries(tsRes.value.data.points || []);
      if (smRes.status === 'fulfilled') setSoilMoisture(smRes.value.data);
    } catch {}
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Field Health Analysis</h1>
        <p>Compute all vegetation indices and trends for any location</p>
      </div>

      {/* ── Input Form ──────────────────────────────────────────────────── */}
      <div className="card mb-24">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label>Latitude</label>
            <input className="input" value={lat} onChange={e => setLat(e.target.value)} style={{ width: 120 }} />
          </div>
          <div>
            <label>Longitude</label>
            <input className="input" value={lon} onChange={e => setLon(e.target.value)} style={{ width: 120 }} />
          </div>
          <div>
            <label>Start Date</label>
            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>End Date</label>
            <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={analyze} disabled={loading}>
            {loading ? <Loader size={16} className="spin" /> : <Search size={16} />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* ── Index Grid ──────────────────────────────────────────────────── */}
      {indices && (
        <>
          <div className="grid-4 mb-24">
            {Object.entries(indices.indices).map(([key, val], i) => (
              <div key={key} className={`card index-card animate-in animate-in-delay-${i % 4}`}>
                <div className="index-label">{key}</div>
                <div className="index-value" style={{ color: getZoneColor(val.health_zone) }}>
                  {val.value !== null ? val.value.toFixed(3) : '—'}
                </div>
                <div className={`index-zone zone-${(val.health_zone || '').toLowerCase()}`}>
                  {val.health_zone}
                </div>
                <div className="text-xs text-muted mt-8">{val.description}</div>
              </div>
            ))}
          </div>

          {/* ── Soil Moisture ─────────────────────────────────────────── */}
          {soilMoisture && (
            <div className="card mb-24 animate-in">
              <div className="card-title mb-16">🌊 Soil Moisture (NASA SMAP)</div>
              <div className="flex gap-24">
                <div>
                  <div className="text-xs text-muted">Surface</div>
                  <div className="font-bold" style={{ fontSize: '1.5rem' }}>
                    {soilMoisture.surface_sm} {soilMoisture.unit}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Sub-surface</div>
                  <div className="font-bold" style={{ fontSize: '1.5rem' }}>
                    {soilMoisture.subsurface_sm} {soilMoisture.unit}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">SMAP Images</div>
                  <div className="font-bold" style={{ fontSize: '1.5rem' }}>
                    {soilMoisture.image_count}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Time Series ───────────────────────────────────────────── */}
          <div className="card animate-in animate-in-delay-2">
            <div className="card-header">
              <div className="card-title"><TrendingUp size={18} /> Temporal Trend</div>
              <div className="badge badge-cyan">{timeseries.length} observations</div>
            </div>
            <div className="chart-container" style={{ height: 350 }}>
              {timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries}>
                    <defs>
                      <linearGradient id="fhNDVI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#66bb6a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#66bb6a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                    <YAxis domain={[-0.3, 1]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#161f1b', border: '1px solid rgba(76,175,80,0.2)',
                        borderRadius: 8, fontSize: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="ndvi" name="NDVI" stroke="#66bb6a" fill="url(#fhNDVI)" strokeWidth={2} />
                    <Line type="monotone" dataKey="evi" name="EVI" stroke="#26c6da" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ndwi" name="NDWI" stroke="#ffb300" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="ndre" name="NDRE" stroke="#ab47bc" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="loading-overlay"><p>No time series data</p></div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
