import { useState } from 'react';
import { Bug, Search, AlertTriangle, Shield, Loader } from 'lucide-react';
import { getPestRisk } from '../utils/api';

const RISK_COLORS = {
  High: 'var(--accent-red)', Medium: 'var(--accent-amber)', Low: 'var(--green-400)',
};

const CROP_OPTIONS = [
  'Rice', 'Wheat', 'Maize', 'Cotton', 'Potato', 'Tomato',
  'Sugarcane', 'Soybean', 'Mustard', 'Grapes',
];

export default function PestRisk() {
  const [form, setForm] = useState({
    crop_type: 'rice', lat: 30.9, lon: 75.85,
    air_temp: 26, humidity: 92, leaf_wetness: 12,
    rainfall_mm: 5, ndvi: 0.6, ndvi_delta: -0.08,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  async function assess() {
    setLoading(true);
    try {
      const res = await getPestRisk(form);
      setResult(res.data);
    } catch {}
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pest Risk Assessment</h1>
        <p>Rule-based environmental thresholds for common Indian crop pests</p>
      </div>

      <div className="grid-2">
        {/* Input form */}
        <div className="card animate-in">
          <div className="card-title mb-16"><Bug size={18} /> Environmental Parameters</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Crop Type</label>
              <select className="select" value={form.crop_type} onChange={e => update('crop_type', e.target.value)}>
                {CROP_OPTIONS.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Air Temperature (°C)</label>
              <input className="input" type="number" value={form.air_temp} onChange={e => update('air_temp', +e.target.value)} />
            </div>
            <div>
              <label>Humidity (%)</label>
              <input className="input" type="number" value={form.humidity} onChange={e => update('humidity', +e.target.value)} />
            </div>
            <div>
              <label>Leaf Wetness (hrs)</label>
              <input className="input" type="number" value={form.leaf_wetness} onChange={e => update('leaf_wetness', +e.target.value)} />
            </div>
            <div>
              <label>Rainfall (mm)</label>
              <input className="input" type="number" value={form.rainfall_mm} onChange={e => update('rainfall_mm', +e.target.value)} />
            </div>
            <div>
              <label>Current NDVI</label>
              <input className="input" type="number" step="0.01" value={form.ndvi} onChange={e => update('ndvi', +e.target.value)} />
            </div>
            <div>
              <label>NDVI Change (7d)</label>
              <input className="input" type="number" step="0.01" value={form.ndvi_delta} onChange={e => update('ndvi_delta', +e.target.value)} />
            </div>
          </div>

          <button className="btn btn-primary w-full mt-24" onClick={assess} disabled={loading}>
            {loading ? <Loader size={16} /> : <Search size={16} />}
            {loading ? 'Evaluating…' : 'Assess Pest Risk'}
          </button>
        </div>

        {/* Results */}
        <div className="card animate-in animate-in-delay-1">
          <div className="card-title mb-16"><Shield size={18} /> Risk Assessment</div>

          {!result ? (
            <div className="loading-overlay">
              <Bug size={40} color="var(--text-dim)" />
              <p>Configure parameters and click "Assess"</p>
            </div>
          ) : (
            <div>
              {/* Overall risk */}
              <div style={{
                textAlign: 'center', padding: 20, marginBottom: 20,
                background: `${RISK_COLORS[result.overall_risk]}11`,
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${RISK_COLORS[result.overall_risk]}33`,
              }}>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                  Overall Risk Level
                </div>
                <div style={{
                  fontSize: '2rem', fontWeight: 800, marginTop: 8,
                  color: RISK_COLORS[result.overall_risk],
                }}>
                  {result.overall_risk}
                </div>
                <div className="text-xs text-muted mt-8">
                  {result.alerts.length} pest threat{result.alerts.length !== 1 && 's'} identified
                </div>
              </div>

              {/* Alert list */}
              {result.alerts.map((alert, i) => (
                <div key={i} style={{
                  padding: 16, marginBottom: 12,
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `3px solid ${RISK_COLORS[alert.risk_level]}`,
                }}>
                  <div className="flex items-center justify-between mb-16">
                    <strong>{alert.pest}</strong>
                    <span className="badge" style={{
                      background: `${RISK_COLORS[alert.risk_level]}22`,
                      color: RISK_COLORS[alert.risk_level],
                    }}>
                      {alert.risk_level} ({(alert.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>

                  <div className="text-xs text-muted mb-16">TRIGGERS</div>
                  <ul style={{ paddingLeft: 16, margin: '0 0 12px', lineHeight: 1.8 }}>
                    {alert.triggers.map((t, j) => (
                      <li key={j} className="text-sm">{t}</li>
                    ))}
                  </ul>

                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommendation</div>
                  <p className="text-sm mt-8" style={{ color: '#2e7d32', lineHeight: 1.6 }}>
                    {alert.recommendation}
                  </p>
                </div>
              ))}

              {result.alerts.length === 0 && (
                <div className="loading-overlay" style={{ padding: 30 }}>
                  <Shield size={40} color="var(--green-400)" />
                  <p>No pest threats for current conditions 🎉</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
