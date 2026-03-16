/**
 * Onboarding wizard — runs once after first registration.
 *
 * Step 1 — Locate Farm     : geocoding search + polygon drawing
 * Step 2 — Field Details   : name, crop, sowing date, irrigation
 * Step 3 — Auto-Analysis   : fetch NDVI + weather + soil → show results → save field
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Leaf, MapPin, Sprout, BarChart3,
  ChevronRight, ChevronLeft, Loader,
  Thermometer, Droplets, Wind, CheckCircle2,
  FlaskConical, Sun, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createField } from '../utils/api';
import api from '../utils/api';
import PolygonMapPicker from '../components/PolygonMapPicker';
import { INDIAN_STATES, DISTRICTS_BY_STATE, CROP_VARIETIES } from '../utils/indiaData';
import toast from 'react-hot-toast';
import './Onboarding.css';

// ── helpers ───────────────────────────────────────────────────────────────────
function polygonCentroid(pts) {
  if (!pts.length) return { lat: 20.5937, lon: 78.9629 };
  return {
    lat: pts.reduce((s, p) => s + p[0], 0) / pts.length,
    lon: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  };
}

function polygonAreaHa(coords) {
  if (coords.length < 3) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const cLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const latM = (Math.PI * R) / 180;
  const lonM = (Math.PI * R * Math.cos(toRad(cLat))) / 180;
  const pts = coords.map(([la, lo]) => [la * latM, lo * lonM]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2 / 10000;
}

const CROP_OPTS = [
  'Rice','Wheat','Maize','Cotton','Potato','Tomato',
  'Sugarcane','Soybean','Groundnut','Mustard','Onion',
  'Chickpea','Lentil','Sunflower','Barley',
];

const IRRIGATION_OPTS = [
  { value: 'rainfed',   label: 'Rainfed' },
  { value: 'canal',     label: 'Canal Irrigation' },
  { value: 'borewell',  label: 'Borewell / Tubewell' },
  { value: 'drip',      label: 'Drip Irrigation' },
  { value: 'sprinkler', label: 'Sprinkler' },
  { value: 'tank',      label: 'Tank / Pond' },
];

// ── Step indicators ───────────────────────────────────────────────────────────
const STEPS = [
  { icon: MapPin,   label: 'Locate Farm' },
  { icon: Sprout,   label: 'Field Details' },
  { icon: BarChart3,label: 'Analysis' },
];

function ndviColor(zone) {
  const map = {
    Excellent: '#4caf50', Good: '#8bc34a', Moderate: '#ffc107',
    Poor: '#ff9800', Critical: '#f44336', Unknown: '#607d8b',
  };
  return map[zone] || '#607d8b';
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [step, setStep]         = useState(0);
  const [polygon, setPolygon]   = useState([]);
  const [details, setDetails]   = useState({
    name: '', crop_type: 'rice', variety: '', sowing_date: '', irrigation_type: 'rainfed',
    state: profile?.state || '', district: profile?.district || '',
  });
  const varieties = CROP_VARIETIES[details.crop_type] || [];
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const areaHa  = polygonAreaHa(polygon);
  const areaAcr = (areaHa * 2.47105).toFixed(2);
  const centroid = polygonCentroid(polygon);

  // ── navigation ───────────────────────────────────────────────────────────
  function nextStep() { setStep(s => s + 1); }
  function prevStep() { setStep(s => s - 1); }

  // ── Step 2 → 3: fetch analysis ───────────────────────────────────────────
  async function runAnalysis() {
    setLoading(true);
    setError('');
    nextStep();
    try {
      const res = await api.post('/api/onboarding/analyze', {
        lat:        centroid.lat,
        lon:        centroid.lon,
        crop_type:  details.crop_type,
        buffer_m:   500,
        polygon:    polygon,
        field_name: details.name || `${details.crop_type} field`,
      });
      setAnalysis(res.data);
    } catch (err) {
      setError('Analysis failed — you can still save your field.');
    }
    setLoading(false);
  }

  // ── Step 3: save field ───────────────────────────────────────────────────
  async function saveField() {
    setLoading(true);
    try {
      await createField({
        name:            details.name || `${details.crop_type} field`,
        lat:             centroid.lat,
        lon:             centroid.lon,
        buffer_m:        500,
        crop_type:       details.crop_type,
        sowing_date:     details.sowing_date || null,
        state:           details.state || profile?.state || null,
        district:        details.district || profile?.district || null,
        irrigation_type: details.irrigation_type,
        polygon:         polygon,
        area_ha:         parseFloat(areaHa.toFixed(4)),
      });
      toast.success('Field saved! Welcome to Croppy.');
      navigate('/');
    } catch (err) {
      console.error('saveField error:', err?.response?.status, err?.response?.data, err?.message);
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
                : Array.isArray(detail)       ? detail.map(d => d.msg).join(', ')
                : err?.message               || 'Failed to save field. Please try again.';
      setError(msg);
      toast.error(msg, { duration: 6000 });
    }
    setLoading(false);
  }

  function skipToApp() {
    navigate('/');
  }

  const upd = (k, v) => setDetails(d => ({ ...d, [k]: v }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="onboard-page">
      {/* Brand strip */}
      <div className="onboard-header">
        <div className="onboard-logo">
          <Leaf size={20} />
          <span>Croppy</span>
        </div>
        <button className="onboard-skip" onClick={skipToApp}>
          Skip for now →
        </button>
      </div>

      {/* Step bar */}
      <div className="onboard-steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? 'done' : i === step ? 'active' : 'idle';
          return (
            <div key={i} className={`onboard-step onboard-step--${state}`}>
              <div className="onboard-step-icon"><Icon size={16} /></div>
              <span>{s.label}</span>
              {i < STEPS.length - 1 && <div className="onboard-step-line" />}
            </div>
          );
        })}
      </div>

      {/* ── STEP 0: Locate Farm ──────────────────────────────────────── */}
      {step === 0 && (
        <div className="onboard-card animate-in">
          <h2>Where is your farm?</h2>
          <p className="onboard-sub">
            Search for your village or town, then draw the boundary of your field
            by clicking on the map. You can add more fields later.
          </p>

          <PolygonMapPicker
            value={polygon}
            onChange={setPolygon}
            center={[centroid.lat, centroid.lon]}
          />

          <div className="onboard-actions">
            <div />
            <button
              className="btn btn-primary"
              disabled={polygon.length < 3}
              onClick={nextStep}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
          {polygon.length < 3 && (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 8 }}>
              Draw at least 3 points to define your field boundary.
            </p>
          )}
        </div>
      )}

      {/* ── STEP 1: Field Details ────────────────────────────────────── */}
      {step === 1 && (
        <div className="onboard-card animate-in">
          <h2>Tell us about your crop</h2>
          <p className="onboard-sub">
            Fill in details about what you're growing. This lets us give you
            crop-specific disease alerts, pest risk, and harvest estimates.
          </p>

          {/* Area summary */}
          <div className="onboard-area-badge">
            <MapPin size={14} />
            Field area: <strong>{areaHa.toFixed(2)} ha</strong> ({areaAcr} acres)
            &nbsp;·&nbsp; Centre: {centroid.lat.toFixed(4)}°N, {centroid.lon.toFixed(4)}°E
          </div>

          <div className="onboard-form-grid">
            <div className="form-group">
              <label>Field Name</label>
              <input
                className="input"
                placeholder="e.g. North Plot, Home Field"
                value={details.name}
                onChange={e => upd('name', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Crop Type *</label>
              <select
                className="select"
                value={details.crop_type}
                onChange={e => { upd('crop_type', e.target.value); upd('variety', ''); }}
              >
                {CROP_OPTS.map(c => (
                  <option key={c} value={c.toLowerCase()}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Crop Variety</label>
              <select
                className="select"
                value={details.variety}
                onChange={e => upd('variety', e.target.value)}
                disabled={!varieties.length}
              >
                <option value="">Select variety (optional)</option>
                {varieties.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Sowing Date</label>
              <input
                className="input"
                type="date"
                value={details.sowing_date}
                onChange={e => upd('sowing_date', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Irrigation Type *</label>
              <select
                className="select"
                value={details.irrigation_type}
                onChange={e => upd('irrigation_type', e.target.value)}
              >
                {IRRIGATION_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Only show state if not already known from profile */}
            {!profile?.state ? (
              <div className="form-group">
                <label>State</label>
                <select
                  className="select"
                  value={details.state}
                  onChange={e => { upd('state', e.target.value); upd('district', ''); }}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : null}

            {/* Only show district if not already known from profile */}
            {!profile?.district ? (
              <div className="form-group">
                <label>District</label>
                <select
                  className="select"
                  value={details.district}
                  onChange={e => upd('district', e.target.value)}
                  disabled={!details.state}
                >
                  <option value="">{details.state ? 'Select district' : 'Select state first'}</option>
                  {(DISTRICTS_BY_STATE[details.state] || []).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Show read-only badge if state/district came from profile */}
            {(profile?.state || profile?.district) && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0 }}>
                  Location from your profile:
                  {profile.state && <strong style={{ color: '#2e7d32', marginLeft: 4 }}>{profile.state}</strong>}
                  {profile.district && <strong style={{ color: '#2e7d32', marginLeft: 4 }}>· {profile.district}</strong>}
                </p>
              </div>
            )}
          </div>

          <div className="onboard-actions">
            <button className="btn btn-secondary" onClick={prevStep}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={runAnalysis}
              disabled={!details.crop_type}
            >
              Analyse My Field <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Auto-Analysis ────────────────────────────────────── */}
      {step === 2 && (
        <div className="onboard-card animate-in">
          <h2>Your Field Analysis</h2>
          <p className="onboard-sub">
            We pulled satellite, weather, and soil data for your field.
          </p>

          {loading && (
            <div className="onboard-loading">
              <Loader size={36} className="spin" />
              <p>Fetching satellite data from Sentinel-2…</p>
              <p style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                Checking weather · Estimating soil type · Running NDVI…
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="onboard-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!loading && analysis && (
            <div className="onboard-analysis">
              {/* NDVI card */}
              <div className="analysis-card">
                <div className="analysis-card-title">
                  <Sun size={16} /> Crop Health (NDVI)
                </div>
                <div
                  className="analysis-ndvi-val"
                  style={{ color: ndviColor(analysis.ndvi?.health_zone) }}
                >
                  {analysis.ndvi?.value != null
                    ? analysis.ndvi.value.toFixed(3)
                    : 'N/A'}
                </div>
                <div
                  className="analysis-zone-badge"
                  style={{ background: ndviColor(analysis.ndvi?.health_zone) + '22',
                           color: ndviColor(analysis.ndvi?.health_zone) }}
                >
                  {analysis.ndvi?.health_zone}
                </div>
                <p className="analysis-desc">{analysis.ndvi?.description}</p>
                <p className="analysis-meta">
                  Based on {analysis.ndvi?.image_count} Sentinel-2 images
                  ({analysis.period?.start} → {analysis.period?.end})
                </p>
              </div>

              {/* Weather card */}
              {analysis.weather && (
                <div className="analysis-card">
                  <div className="analysis-card-title">
                    <Thermometer size={16} /> Current Weather
                  </div>
                  <div className="analysis-weather-row">
                    <span><Thermometer size={13} /> {analysis.weather.temp_c?.toFixed(1)}°C</span>
                    <span><Droplets size={13} /> {analysis.weather.humidity_pct}% RH</span>
                    <span><Wind size={13} /> {analysis.weather.wind_kph?.toFixed(1)} km/h</span>
                  </div>
                  <p className="analysis-desc" style={{ textTransform: 'capitalize' }}>
                    {analysis.weather.description}
                  </p>
                  {analysis.weather.rainfall_mm > 0 && (
                    <p className="analysis-meta">Rainfall: {analysis.weather.rainfall_mm} mm</p>
                  )}
                </div>
              )}

              {/* Soil card */}
              {analysis.soil?.available && (
                <div className="analysis-card">
                  <div className="analysis-card-title">
                    <FlaskConical size={16} /> Soil (Estimated)
                  </div>
                  <div className="analysis-soil-type">{analysis.soil.soil_type}</div>
                  {analysis.soil.ph != null && (
                    <>
                      <div className="analysis-ph">pH {analysis.soil.ph}</div>
                      <p className="analysis-desc">{analysis.soil.ph_desc}</p>
                    </>
                  )}
                  <div className="analysis-texture">
                    {analysis.soil.clay_pct != null && <span>Clay {analysis.soil.clay_pct}%</span>}
                    {analysis.soil.sand_pct != null && <span>Sand {analysis.soil.sand_pct}%</span>}
                    {analysis.soil.silt_pct != null && <span>Silt {analysis.soil.silt_pct}%</span>}
                  </div>
                  <p className="analysis-meta">Source: {analysis.soil.source} · {analysis.soil.depth}</p>
                </div>
              )}
            </div>
          )}

          <div className="onboard-actions" style={{ marginTop: 24 }}>
            <button className="btn btn-secondary" onClick={prevStep} disabled={loading}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={saveField}
              disabled={loading}
            >
              {loading ? <Loader size={15} className="spin" /> : <CheckCircle2 size={15} />}
              Save Field & Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
