import { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { getAlerts, acknowledgeAlert, deleteAlert } from '../utils/api';
import toast from 'react-hot-toast';

const SEV = {
  High:   { color: '#ef5350', bg: 'rgba(239,83,80,0.08)',   border: '#ef5350'  },
  Medium: { color: '#ffb300', bg: 'rgba(255,179,0,0.08)',   border: '#ffb300'  },
  Low:    { color: '#66bb6a', bg: 'rgba(102,187,106,0.08)', border: '#66bb6a'  },
};

const TYPE_LABEL = {
  ndvi_drop:      'NDVI Drop',
  drought_stress: 'Drought Stress',
  low_vegetation: 'Low Vegetation',
  chlorophyll_low:'Chlorophyll Low',
  bare_soil_risk: 'Bare Soil Risk',
  pest_risk_high: 'Pest Risk — High',
  pest_risk_medium:'Pest Risk — Medium',
  disease_detected:'Disease Detected',
  irrigation_needed:'Irrigation Needed',
  frost_risk:     'Frost Risk',
  spray_warning:  'Spray Warning',
};

function AlertRow({ alert, onAck, onDelete }) {
  const s = SEV[alert.severity] || SEV.Low;
  const label = TYPE_LABEL[alert.alert_type] || alert.alert_type?.replace(/_/g, ' ');

  return (
    <div style={{
      padding: '14px 16px', marginBottom: 10,
      background: s.bg, borderRadius: 10,
      borderLeft: `3px solid ${s.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={17} color={s.color} />
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</span>
            <span style={{
              marginLeft: 8, fontSize: '0.72rem', padding: '2px 8px', borderRadius: 20,
              background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}`,
            }}>{alert.severity}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!alert.acknowledged && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              onClick={() => onAck(alert.id)}
            >
              <CheckCircle size={13} /> Acknowledge
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.78rem', padding: '5px 10px', color: '#ef5350' }}
            onClick={() => onDelete(alert.id)}
          >
            ×
          </button>
        </div>
      </div>
      <p style={{ margin: '8px 0 6px 27px', fontSize: '0.83rem', color: '#2e7d32', lineHeight: 1.55 }}>
        {alert.message}
      </p>
      <div style={{ display: 'flex', gap: 16, marginLeft: 27, fontSize: '0.75rem', color: '#4a6650' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> {new Date(alert.triggered_at).toLocaleString('en-IN')}
        </span>
        {alert.triggered_by && <span>Source: {alert.triggered_by}</span>}
      </div>
    </div>
  );
}

export default function Alerts() {
  const [alerts,   setAlerts]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('active'); // 'active' | 'all'

  async function load() {
    setLoading(true);
    try {
      const r = await getAlerts(filter === 'active');
      setAlerts(r.data || []);
    } catch {
      // Fall back to empty
      setAlerts([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleAck(id) {
    try {
      await acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
      toast.success('Alert acknowledged');
    } catch { toast.error('Failed to acknowledge'); }
  }

  async function handleDelete(id) {
    try {
      await deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success('Alert removed');
    } catch { toast.error('Failed to delete'); }
  }

  const active   = alerts.filter(a => !a.acknowledged);
  const resolved = alerts.filter(a =>  a.acknowledged);
  const high     = active.filter(a => a.severity === 'High').length;
  const medium   = active.filter(a => a.severity === 'Medium').length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Alerts</h1>
          <p>Automated satellite-driven warnings for crop health anomalies and environmental stress</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={filter === 'active' ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: '0.82rem' }}
            onClick={() => setFilter('active')}
          >Active</button>
          <button
            className={filter === 'all' ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: '0.82rem' }}
            onClick={() => setFilter('all')}
          >All</button>
          <button className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={load}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-3 mb-24">
        <div className="card animate-in" style={{ textAlign: 'center' }}>
          <AlertTriangle size={26} color="#ef5350" />
          <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 6 }}>{high}</div>
          <div className="text-xs text-muted">High Severity</div>
        </div>
        <div className="card animate-in animate-in-delay-1" style={{ textAlign: 'center' }}>
          <Bell size={26} color="#ffb300" />
          <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 6 }}>{active.length}</div>
          <div className="text-xs text-muted">Active Alerts</div>
        </div>
        <div className="card animate-in animate-in-delay-2" style={{ textAlign: 'center' }}>
          <CheckCircle size={26} color="var(--green-400)" />
          <div style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: 6 }}>{resolved.length}</div>
          <div className="text-xs text-muted">Resolved</div>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay" style={{ height: 200 }}>
          <div className="spinner" /><p>Loading alerts…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Active */}
          <div className="card mb-24 animate-in">
            <div className="card-header">
              <div className="card-title"><Bell size={18} /> Active Alerts</div>
              {active.length > 0 && <span className="badge badge-red">{active.length}</span>}
            </div>
            {active.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <CheckCircle size={36} color="var(--green-400)" />
                <p className="text-muted" style={{ marginTop: 10 }}>All clear — no active alerts!</p>
                <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                  Alerts are auto-generated when satellite indices are computed for your fields.
                </p>
              </div>
            ) : (
              active.map(a => <AlertRow key={a.id} alert={a} onAck={handleAck} onDelete={handleDelete} />)
            )}
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div className="card animate-in">
              <div className="card-header">
                <div className="card-title"><CheckCircle size={18} /> Resolved</div>
              </div>
              {resolved.map(a => (
                <div key={a.id} style={{
                  padding: '10px 14px', marginBottom: 8, opacity: 0.55,
                  background: 'rgba(67,160,71,0.03)', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <CheckCircle size={15} color="var(--green-400)" />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>
                      {TYPE_LABEL[a.alert_type] || a.alert_type}
                    </span>
                    <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#4a6650' }}>
                      {a.message?.slice(0, 80)}…
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#ef5350', padding: '4px 8px' }}
                    onClick={() => handleDelete(a.id)}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
