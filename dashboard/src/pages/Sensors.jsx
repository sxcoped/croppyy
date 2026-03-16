import { useState, useEffect } from 'react';
import { Cpu, Plus, CheckCircle, Loader, History, Droplets, CloudRain, Thermometer, Wind } from 'lucide-react';
import toast from 'react-hot-toast';
import { listFields, ingestSensor, getSensorLatest, getSensorHistory } from '../utils/api';

const EMPTY_FORM = {
  field_id: '',
  device_id: 'manual-entry',
  soil_moisture: '',
  soil_temp: '',
  air_temp: '',
  humidity: '',
  rainfall: '',
  leaf_wetness: '',
};

export default function Sensors() {
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    listFields()
      .then(r => {
        const list = r.data || [];
        setFields(list);
        if (list.length) {
          const first = list[0];
          setForm(f => ({ ...f, field_id: first.id }));
          loadSensorData(first.id);
        }
      })
      .catch(() => {});
  }, []);

  function loadSensorData(fieldId) {
    if (!fieldId) return;
    getSensorLatest(fieldId)
      .then(r => setLatest(r.data))
      .catch(() => setLatest(null));
    setHistLoading(true);
    getSensorHistory(fieldId, 20)
      .then(r => setHistory(r.data?.readings || []))
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false));
  }

  function onFieldChange(id) {
    setForm(f => ({ ...f, field_id: id }));
    setLatest(null);
    setHistory([]);
    loadSensorData(id);
  }

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.field_id) { toast.error('Select a field first'); return; }

    const hasAny = ['soil_moisture', 'soil_temp', 'air_temp', 'humidity', 'rainfall', 'leaf_wetness']
      .some(k => form[k] !== '');
    if (!hasAny) { toast.error('Enter at least one reading'); return; }

    const payload = { device_id: form.device_id, field_id: form.field_id };
    ['soil_moisture', 'soil_temp', 'air_temp', 'humidity', 'rainfall', 'leaf_wetness'].forEach(k => {
      if (form[k] !== '') payload[k] = parseFloat(form[k]);
    });

    setSubmitting(true);
    try {
      await ingestSensor(payload);
      toast.success('Sensor reading saved');
      setForm(f => ({ ...EMPTY_FORM, field_id: f.field_id, device_id: f.device_id }));
      loadSensorData(form.field_id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save reading');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedField = fields.find(f => f.id === form.field_id);

  return (
    <div>
      <div className="page-header">
        <h1>Sensor Data Input</h1>
        <p>Manually log soil moisture, rainfall and other sensor readings for your fields</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* ── Input form ───────────────────────────────────────────────── */}
        <div>
          <form className="card" onSubmit={submit}>
            <div className="card-header" style={{ marginBottom: 20 }}>
              <div className="card-title"><Plus size={18} /> Log New Reading</div>
            </div>

            {/* Field selector */}
            <div style={{ marginBottom: 16 }}>
              <label>Field</label>
              {fields.length > 0 ? (
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={form.field_id}
                  onChange={e => onFieldChange(e.target.value)}
                >
                  {fields.map(f => (
                    <option key={f.id} value={f.id}>{f.name} — {f.crop_type}</option>
                  ))}
                </select>
              ) : (
                <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                  No fields found. Add a field first.
                </div>
              )}
            </div>

            {/* Device ID */}
            <div style={{ marginBottom: 20 }}>
              <label>Device / Source ID</label>
              <input
                className="input"
                style={{ width: '100%' }}
                placeholder="e.g. manual-entry, sensor-001"
                value={form.device_id}
                onChange={e => set('device_id', e.target.value)}
              />
            </div>

            {/* Readings grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Droplets size={13} color="#26c6da" /> Soil Moisture (%)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 35.2"
                  value={form.soil_moisture}
                  onChange={e => set('soil_moisture', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CloudRain size={13} color="#26c6da" /> Rainfall (mm)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 12.5"
                  value={form.rainfall}
                  onChange={e => set('rainfall', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Thermometer size={13} color="#ff7043" /> Soil Temp (°C)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.1"
                  placeholder="e.g. 24.0"
                  value={form.soil_temp}
                  onChange={e => set('soil_temp', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Thermometer size={13} color="#ffb300" /> Air Temp (°C)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.1"
                  placeholder="e.g. 28.0"
                  value={form.air_temp}
                  onChange={e => set('air_temp', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wind size={13} color="#66bb6a" /> Humidity (%)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 65"
                  value={form.humidity}
                  onChange={e => set('humidity', e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Droplets size={13} color="#ab47bc" /> Leaf Wetness (0–1)
                </label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="e.g. 0.4"
                  value={form.leaf_wetness}
                  onChange={e => set('leaf_wetness', e.target.value)}
                />
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
              {submitting ? 'Saving…' : 'Save Reading'}
            </button>
          </form>
        </div>

        {/* ── Right panel: latest + history ────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Latest reading */}
          {latest && (
            <div className="card animate-in">
              <div className="card-header" style={{ marginBottom: 16 }}>
                <div className="card-title"><Cpu size={18} /> Latest Reading</div>
                <span className="badge badge-green">{selectedField?.name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Soil Moisture', value: latest.soil_moisture != null ? `${latest.soil_moisture}%` : '—', color: '#26c6da' },
                  { label: 'Rainfall',      value: latest.rainfall != null      ? `${latest.rainfall} mm`   : '—', color: '#26c6da' },
                  { label: 'Soil Temp',     value: latest.soil_temp != null     ? `${latest.soil_temp}°C`   : '—', color: '#ff7043' },
                  { label: 'Air Temp',      value: latest.air_temp != null      ? `${latest.air_temp}°C`    : '—', color: '#ffb300' },
                  { label: 'Humidity',      value: latest.humidity != null      ? `${latest.humidity}%`     : '—', color: '#66bb6a' },
                  { label: 'Leaf Wetness',  value: latest.leaf_wetness != null  ? latest.leaf_wetness       : '—', color: '#ab47bc' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(67,160,71,0.03)', border: '1px solid rgba(67,160,71,0.06)' }}>
                    <div className="text-xs text-muted">{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color }}>{value}</div>
                  </div>
                ))}
              </div>
              {latest.recorded_at && (
                <div className="text-xs text-muted" style={{ marginTop: 12 }}>
                  Recorded: {new Date(latest.recorded_at).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="card animate-in">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title"><History size={18} /> Recent Readings</div>
            </div>
            {histLoading && (
              <div className="loading-overlay" style={{ height: 80 }}>
                <div className="spinner" />
              </div>
            )}
            {!histLoading && history.length === 0 && (
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>No readings logged yet for this field.</p>
            )}
            {!histLoading && history.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>SM %</th>
                      <th>Rain mm</th>
                      <th>Air °C</th>
                      <th>RH %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r, i) => (
                      <tr key={i}>
                        <td className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {r.recorded_at ? new Date(r.recorded_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ color: '#26c6da' }}>{r.soil_moisture ?? '—'}</td>
                        <td style={{ color: '#26c6da' }}>{r.rainfall ?? '—'}</td>
                        <td style={{ color: '#ffb300' }}>{r.air_temp ?? '—'}</td>
                        <td style={{ color: '#66bb6a' }}>{r.humidity ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
