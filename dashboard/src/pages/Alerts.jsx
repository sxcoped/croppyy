import { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { getAlerts, acknowledgeAlert } from '../utils/api';

const SEVERITY_STYLE = {
  High:     { color: 'var(--accent-red)',    bg: 'rgba(239,83,80,0.08)',   border: 'var(--accent-red)' },
  Medium:   { color: 'var(--accent-amber)',  bg: 'rgba(255,179,0,0.08)',   border: 'var(--accent-amber)' },
  Low:      { color: 'var(--green-400)',     bg: 'rgba(76,175,80,0.08)',   border: 'var(--green-400)' },
};

// Demo alerts for when backend has none
const DEMO_ALERTS = [
  {
    id: 'demo-1', field_id: 'field-1', alert_type: 'NDVI Crash',
    severity: 'High', message: 'NDVI dropped by 0.18 in the last 7 days for Field A (Punjab). Possible pest attack or drought stress.',
    triggered_at: new Date(Date.now() - 2 * 3600000).toISOString(), acknowledged: false,
  },
  {
    id: 'demo-2', field_id: 'field-2', alert_type: 'Pest Risk',
    severity: 'Medium', message: 'Rice Blast risk elevated for Field B. Temperature 26°C + Humidity 93% + Leaf wetness > 10 hrs.',
    triggered_at: new Date(Date.now() - 8 * 3600000).toISOString(), acknowledged: false,
  },
  {
    id: 'demo-3', field_id: 'field-1', alert_type: 'Soil Moisture',
    severity: 'High', message: 'Soil moisture critical (<18% VWC) for 4 consecutive days in Field A. Irrigate immediately.',
    triggered_at: new Date(Date.now() - 24 * 3600000).toISOString(), acknowledged: true,
  },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState(DEMO_ALERTS);

  function handleAck(id) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  }

  const active = alerts.filter(a => !a.acknowledged);
  const resolved = alerts.filter(a => a.acknowledged);

  return (
    <div>
      <div className="page-header">
        <h1>Alerts</h1>
        <p>Automated warnings for crop health anomalies, pest risks, and environmental stress</p>
      </div>

      {/* Summary */}
      <div className="grid-3 mb-24">
        <div className="card animate-in" style={{ textAlign: 'center' }}>
          <AlertTriangle size={28} color="var(--accent-red)" />
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: 8 }}>
            {active.filter(a => a.severity === 'High').length}
          </div>
          <div className="text-xs text-muted">High Severity</div>
        </div>
        <div className="card animate-in animate-in-delay-1" style={{ textAlign: 'center' }}>
          <Bell size={28} color="var(--accent-amber)" />
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: 8 }}>{active.length}</div>
          <div className="text-xs text-muted">Active Alerts</div>
        </div>
        <div className="card animate-in animate-in-delay-2" style={{ textAlign: 'center' }}>
          <CheckCircle size={28} color="var(--green-400)" />
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: 8 }}>{resolved.length}</div>
          <div className="text-xs text-muted">Resolved</div>
        </div>
      </div>

      {/* Active alerts */}
      <div className="card mb-24 animate-in animate-in-delay-2">
        <div className="card-header">
          <div className="card-title"><Bell size={18} /> Active Alerts</div>
          <span className="badge badge-red">{active.length} active</span>
        </div>

        {active.length === 0 ? (
          <div className="loading-overlay" style={{ padding: 30 }}>
            <CheckCircle size={40} color="var(--green-400)" />
            <p>All clear — no active alerts! 🎉</p>
          </div>
        ) : (
          active.map(alert => {
            const style = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.Low;
            return (
              <div key={alert.id} style={{
                padding: 16, marginBottom: 12,
                background: style.bg, borderRadius: 'var(--radius-md)',
                borderLeft: `3px solid ${style.border}`,
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-12">
                    <AlertTriangle size={18} color={style.color} />
                    <div>
                      <strong>{alert.alert_type}</strong>
                      <span className="badge ml-8" style={{ background: `${style.color}22`, color: style.color, marginLeft: 8 }}>
                        {alert.severity}
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleAck(alert.id)}>
                    <CheckCircle size={14} /> Acknowledge
                  </button>
                </div>
                <p className="text-sm mt-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {alert.message}
                </p>
                <div className="flex items-center gap-8 mt-8 text-xs text-muted">
                  <Clock size={12} />
                  {new Date(alert.triggered_at).toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="card animate-in">
          <div className="card-header">
            <div className="card-title"><CheckCircle size={18} /> Resolved</div>
          </div>
          {resolved.map(alert => (
            <div key={alert.id} style={{
              padding: 12, marginBottom: 8,
              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
              opacity: 0.6,
            }}>
              <div className="flex items-center gap-12">
                <CheckCircle size={16} color="var(--green-400)" />
                <div>
                  <strong className="text-sm">{alert.alert_type}</strong>
                  <p className="text-xs text-muted mt-8">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
