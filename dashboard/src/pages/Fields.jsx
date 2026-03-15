import { useState, useEffect } from 'react';
import { Map, Plus, Trash2, Eye } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { listFields, createField, deleteField } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CROP_OPTS = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Potato', 'Tomato', 'Sugarcane', 'Soybean'];

export default function Fields() {
  const [fields, setFields] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', lat: '30.9', lon: '75.85', buffer_m: 1000,
    crop_type: 'rice', sowing_date: '2025-11-01', state: 'Punjab', district: 'Ludhiana', irrigation_type: 'canal',
  });
  const navigate = useNavigate();

  async function load() {
    try { const r = await listFields(); setFields(r.data); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createField({ ...form, lat: parseFloat(form.lat), lon: parseFloat(form.lon), buffer_m: parseInt(form.buffer_m) });
      setShowForm(false);
      load();
    } catch {}
  }

  async function handleDelete(id) {
    try { await deleteField(id); load(); } catch {}
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>My Fields</h1>
          <p>Manage your registered field locations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Add Field
        </button>
      </div>

      {/* Registration form */}
      {showForm && (
        <div className="card mb-24 animate-in">
          <div className="card-title mb-16"><Plus size={18} /> Register New Field</div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div><label>Field Name</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} required /></div>
              <div><label>Latitude</label><input className="input" value={form.lat} onChange={e => update('lat', e.target.value)} required /></div>
              <div><label>Longitude</label><input className="input" value={form.lon} onChange={e => update('lon', e.target.value)} required /></div>
              <div><label>Buffer (m)</label><input className="input" type="number" value={form.buffer_m} onChange={e => update('buffer_m', e.target.value)} /></div>
              <div>
                <label>Crop Type</label>
                <select className="select" value={form.crop_type} onChange={e => update('crop_type', e.target.value)}>
                  {CROP_OPTS.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                </select>
              </div>
              <div><label>Sowing Date</label><input className="input" type="date" value={form.sowing_date} onChange={e => update('sowing_date', e.target.value)} /></div>
              <div><label>State</label><input className="input" value={form.state} onChange={e => update('state', e.target.value)} /></div>
              <div><label>District</label><input className="input" value={form.district} onChange={e => update('district', e.target.value)} /></div>
              <div>
                <label>Irrigation</label>
                <select className="select" value={form.irrigation_type} onChange={e => update('irrigation_type', e.target.value)}>
                  <option value="rainfed">Rainfed</option>
                  <option value="canal">Canal</option>
                  <option value="borewell">Borewell</option>
                  <option value="drip">Drip</option>
                </select>
              </div>
            </div>
            <div className="flex gap-12 mt-24">
              <button className="btn btn-primary" type="submit">Create Field</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Map view */}
      <div className="card mb-24 animate-in">
        <div className="card-title mb-16"><Map size={18} /> Field Map</div>
        <div className="map-container" style={{ height: 360 }}>
          <MapContainer center={[30.9, 75.85]} zoom={7} scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
            {fields.map(f => (
              <Marker key={f.id} position={[f.lat, f.lon]}>
                <Popup>
                  <strong>{f.name}</strong><br />
                  {f.crop_type} — {f.state}<br />
                  Sowing: {f.sowing_date}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Field list */}
      {fields.length > 0 ? (
        <div className="card animate-in animate-in-delay-1">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Crop</th><th>Location</th>
                  <th>State</th><th>Sowing</th><th>Irrigation</th><th></th>
                </tr>
              </thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.name}</strong></td>
                    <td><span className="badge badge-green">{f.crop_type}</span></td>
                    <td>{f.lat.toFixed(2)}°, {f.lon.toFixed(2)}°</td>
                    <td>{f.state}, {f.district}</td>
                    <td>{f.sowing_date}</td>
                    <td>{f.irrigation_type}</td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/health`)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(f.id)} style={{ color: 'var(--accent-red)' }}>
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
