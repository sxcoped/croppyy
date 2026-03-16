import { useState, useEffect } from 'react';
import { Map, Plus, Trash2, Eye, ChevronUp } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import { listFields, createField, deleteField } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import PolygonMapPicker from '../components/PolygonMapPicker';
import { INDIAN_STATES, DISTRICTS_BY_STATE } from '../utils/indiaData';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CROP_OPTS = [
  'Rice', 'Wheat', 'Maize', 'Cotton', 'Potato', 'Tomato',
  'Sugarcane', 'Soybean', 'Groundnut', 'Mustard', 'Onion',
  'Chickpea', 'Lentil', 'Sunflower', 'Barley',
];

function polygonCentroid(pts) {
  if (!pts || !pts.length) return null;
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function polygonAreaHa(coords) {
  if (!coords || coords.length < 3) return 0;
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

export default function Fields() {
  const [fields, setFields]     = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [polygon, setPolygon]   = useState([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm] = useState({
    name: '', crop_type: 'rice', sowing_date: '',
    state: '', district: '', irrigation_type: 'rainfed',
  });
  const navigate = useNavigate();

  async function load() {
    try {
      const r = await listFields();
      setFields(r.data);
    } catch (err) {
      console.error('Failed to load fields:', err?.response?.data || err.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const centroid = polygonCentroid(polygon);
    if (!centroid) { setError('Please draw your field boundary on the map first.'); return; }
    const areaHa = polygonAreaHa(polygon);
    setSaving(true);
    try {
      await createField({
        ...form,
        sowing_date: form.sowing_date || null,
        state:       form.state || null,
        district:    form.district || null,
        lat:         centroid[0],
        lon:         centroid[1],
        buffer_m:    500,
        polygon:     polygon.length >= 3 ? polygon : null,
        area_ha:     areaHa > 0 ? parseFloat(areaHa.toFixed(4)) : null,
      });
      setShowForm(false);
      setPolygon([]);
      setForm({ name: '', crop_type: 'rice', sowing_date: '', state: '', district: '', irrigation_type: 'rainfed' });
      load();
    } catch (err) {
      console.error('createField error:', err?.response?.status, err?.response?.data, err?.message);
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
                : Array.isArray(detail)       ? detail.map(d => d.msg).join(', ')
                : err?.message               || 'Failed to save field. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try { await deleteField(id); load(); } catch (err) {
      console.error('Delete failed:', err?.response?.data || err.message);
    }
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mapCenter = fields.length
    ? [fields.reduce((s, f) => s + f.lat, 0) / fields.length,
       fields.reduce((s, f) => s + f.lon, 0) / fields.length]
    : [20.5937, 78.9629];

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>My Fields</h1>
          <p>Manage your registered field locations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <ChevronUp size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Field'}
        </button>
      </div>

      {/* ── Add Field form ───────────────────────────────────────────── */}
      {showForm && (
        <div className="card mb-24 animate-in">
          <div className="card-title mb-16"><Plus size={18} /> Register New Field</div>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.8rem',
                color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Field Boundary *
              </label>
              <PolygonMapPicker value={polygon} onChange={setPolygon} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div>
                <label>Field Name</label>
                <input className="input" value={form.name} placeholder="e.g. North Plot"
                  onChange={e => update('name', e.target.value)} />
              </div>
              <div>
                <label>Crop Type</label>
                <select className="select" value={form.crop_type}
                  onChange={e => update('crop_type', e.target.value)}>
                  {CROP_OPTS.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>Sowing Date</label>
                <input className="input" type="date" value={form.sowing_date}
                  onChange={e => update('sowing_date', e.target.value)} />
              </div>
              <div>
                <label>State</label>
                <select className="select" value={form.state}
                  onChange={e => { update('state', e.target.value); update('district', ''); }}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>District</label>
                <select className="select" value={form.district}
                  onChange={e => update('district', e.target.value)}
                  disabled={!form.state}>
                  <option value="">{form.state ? 'Select district' : 'Select state first'}</option>
                  {(DISTRICTS_BY_STATE[form.state] || []).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Irrigation</label>
                <select className="select" value={form.irrigation_type}
                  onChange={e => update('irrigation_type', e.target.value)}>
                  <option value="rainfed">Rainfed</option>
                  <option value="canal">Canal</option>
                  <option value="borewell">Borewell</option>
                  <option value="drip">Drip</option>
                  <option value="sprinkler">Sprinkler</option>
                </select>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: '0.82rem', color: 'var(--accent-red)', marginTop: 12,
                padding: '10px 14px', background: 'rgba(244,67,54,0.1)', borderRadius: 8,
                border: '1px solid rgba(244,67,54,0.25)' }}>
                {error}
              </p>
            )}
            <div className="flex gap-12 mt-24">
              <button className="btn btn-primary" type="submit" disabled={polygon.length < 3 || saving}>
                {saving ? 'Saving…' : 'Create Field'}
              </button>
              <button className="btn btn-secondary" type="button"
                onClick={() => { setShowForm(false); setPolygon([]); setError(''); }}>
                Cancel
              </button>
            </div>
            {polygon.length < 3 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8 }}>
                Draw your field boundary on the map first (minimum 3 points).
              </p>
            )}
          </form>
        </div>
      )}

      {/* ── Overview map ─────────────────────────────────────────────── */}
      <div className="card mb-24 animate-in">
        <div className="card-title mb-16"><Map size={18} /> Field Map</div>
        <div className="map-container" style={{ height: 360 }}>
          <MapContainer center={mapCenter} zoom={fields.length ? 9 : 5} scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
            {fields.map(f => {
              const hasPolygon = f.polygon && f.polygon.length >= 3;
              return hasPolygon ? (
                <Polygon key={f.id} positions={f.polygon}
                  pathOptions={{ color: '#66bb6a', fillColor: '#66bb6a', fillOpacity: 0.2, weight: 2 }}>
                  <Popup>
                    <strong>{f.name}</strong><br />
                    {f.crop_type} — {f.state}<br />
                    {f.area_ha ? `${f.area_ha.toFixed(2)} ha` : ''}
                  </Popup>
                </Polygon>
              ) : (
                <Marker key={f.id} position={[f.lat, f.lon]}>
                  <Popup>
                    <strong>{f.name}</strong><br />
                    {f.crop_type} — {f.state}<br />
                    Sowing: {f.sowing_date}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* ── Field list ───────────────────────────────────────────────── */}
      {fields.length > 0 ? (
        <div className="card animate-in animate-in-delay-1">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Crop</th><th>Area</th>
                  <th>State</th><th>Sowing</th><th>Irrigation</th><th></th>
                </tr>
              </thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.name}</strong></td>
                    <td><span className="badge badge-green">{f.crop_type}</span></td>
                    <td>{f.area_ha ? `${f.area_ha.toFixed(2)} ha` : `${f.lat.toFixed(2)}°, ${f.lon.toFixed(2)}°`}</td>
                    <td>{f.state}, {f.district}</td>
                    <td>{f.sowing_date || '—'}</td>
                    <td>{f.irrigation_type}</td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/health')}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-sm btn-secondary"
                          onClick={() => handleDelete(f.id)}
                          style={{ color: 'var(--accent-red)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card animate-in">
          <div className="loading-overlay">
            <Map size={40} color="var(--text-dim)" />
            <p>No fields registered yet. Click "Add Field" to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
}
