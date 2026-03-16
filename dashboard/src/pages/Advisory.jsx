import { useState, useEffect } from 'react';
import { Loader, Sprout, Zap, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import { listFields, getAdvisory } from '../utils/api';

// ── Severity badge ────────────────────────────────────────────────────────────
const SEV = {
  danger:  { bg: 'rgba(239,83,80,0.10)',   border: '#ef5350', text: '#ef5350',   label: 'Critical' },
  warning: { bg: 'rgba(255,179,0,0.10)',   border: '#ffb300', text: '#ffb300',   label: 'Warning'  },
  success: { bg: 'rgba(102,187,106,0.10)', border: '#66bb6a', text: '#66bb6a',   label: 'Good'     },
  info:    { bg: 'rgba(67,160,71,0.04)', border: 'rgba(67,160,71,0.12)', text: '#4a6650', label: 'Info' },
};

function AdvisoryCard({ card }) {
  const s = SEV[card.severity] || SEV.info;
  return (
    <div style={{
      border: `1px solid ${s.border}`, background: s.bg,
      borderRadius: 12, padding: '14px 18px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: s.text }}>{card.title}</span>
        <span style={{ fontSize: '0.72rem', color: s.text, border: `1px solid ${s.border}`, borderRadius: 20, padding: '1px 8px' }}>{s.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: '0.84rem', color: '#2e7d32', lineHeight: 1.55 }}>{card.message}</p>
    </div>
  );
}

// ── Stage timeline ────────────────────────────────────────────────────────────
function StageTimeline({ stages, currentName }) {
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 0, minWidth: 600 }}>
        {stages.map((s, i) => {
          const isActive = s.status === 'active';
          const isDone   = s.status === 'done';
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
              {/* connector line */}
              {i < stages.length - 1 && (
                <div style={{
                  position: 'absolute', top: 11, left: '50%', right: '-50%', height: 2,
                  background: isDone ? '#66bb6a' : 'rgba(67,160,71,0.08)', zIndex: 0,
                }} />
              )}
              {/* dot */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', margin: '0 auto 8px',
                background: isActive ? (s.critical ? '#ff7043' : '#66bb6a')
                           : isDone  ? 'rgba(102,187,106,0.4)'
                           : 'rgba(67,160,71,0.08)',
                border: `2px solid ${isActive ? (s.critical ? '#ff7043' : '#66bb6a') : isDone ? '#66bb6a' : 'rgba(67,160,71,0.15)'}`,
                position: 'relative', zIndex: 1,
              }} />
              <div style={{
                fontSize: '0.68rem', lineHeight: 1.3, padding: '0 2px',
                color: isActive ? '#1b5e20' : '#4a6650',
                fontWeight: isActive ? 700 : 400,
              }}>
                {s.name}
              </div>
              <div style={{ fontSize: '0.6rem', color: '#4a6650', marginTop: 2 }}>
                D{s.start}–{s.end}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fertilizer table ──────────────────────────────────────────────────────────
function FertilizerTable({ recs }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card animate-in">
      <div
        className="card-header"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="card-title"><FlaskConical size={18} /> Fertiliser Schedule</div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(67,160,71,0.08)' }}>
                {['Nutrient', 'Dose', 'Split / Timing', 'Product'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#4a6650', fontWeight: 600, fontSize: '0.76rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recs.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(67,160,71,0.04)' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600 }}>{r.nutrient}</td>
                  <td style={{ padding: '9px 10px', color: '#66bb6a' }}>{r.dose}</td>
                  <td style={{ padding: '9px 10px', color: '#2e7d32' }}>{r.split}</td>
                  <td style={{ padding: '9px 10px', color: '#4a6650' }}>{r.product}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recs.some(r => r.note) && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,179,0,0.07)', borderRadius: 8, fontSize: '0.8rem', color: '#ffb300', borderLeft: '3px solid #ffb300' }}>
              {recs.find(r => r.note)?.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Advisory() {
  const [fields,      setFields]      = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [advisory,    setAdvisory]    = useState(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    listFields().then(r => {
      const list = r.data || [];
      setFields(list);
      if (list.length) setActiveField(list[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeField) return;
    setLoading(true);
    setAdvisory(null);
    const { lat, lon, crop_type, sowing_date } = activeField;
    getAdvisory({ crop_type, lat, lon, sowing_date: sowing_date || null })
      .then(r => setAdvisory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeField]);

  const stage = advisory?.growth_stage;
  const cards = advisory?.advisory_cards || [];
  const fert  = advisory?.fertilizer_schedule || [];

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Advisory Engine</h1>
          <p>Crop calendar, weather-based advisories, and fertiliser schedule</p>
        </div>
        {fields.length > 1 && (
          <select
            className="input"
            style={{ width: 'auto', minWidth: 180 }}
            value={activeField?.id || ''}
            onChange={e => setActiveField(fields.find(f => f.id === e.target.value))}
          >
            {fields.map(f => <option key={f.id} value={f.id}>{f.name} ({f.crop_type})</option>)}
          </select>
        )}
      </div>

      {/* No fields */}
      {!loading && fields.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="text-muted">Register a field first to get advisory data.</p>
        </div>
      )}

      {loading && (
        <div className="loading-overlay" style={{ height: 260 }}>
          <Loader size={28} className="spin" />
          <p style={{ marginTop: 12 }}>Generating advisory…</p>
        </div>
      )}

      {!loading && advisory && (
        <>
          {/* ── Summary strip ────────────────────────────────────────────── */}
          <div className="grid-3 mb-24">
            <div className="card animate-in" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: advisory.has_critical ? '#ef5350' : '#66bb6a' }}>
                {cards.length}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Active Advisories</div>
            </div>
            <div className="card animate-in" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffb300' }}>
                {cards.filter(c => c.severity === 'danger').length}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Critical Alerts</div>
            </div>
            <div className="card animate-in" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                {stage?.status === 'active' ? stage.current_stage.name : '—'}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                {stage?.status === 'active' ? `Day ${stage.das}` : 'No sowing date set'}
              </div>
            </div>
          </div>

          {/* ── Growth stage timeline ────────────────────────────────────── */}
          {stage?.status === 'active' && (
            <div className="card mb-24 animate-in">
              <div className="card-title mb-20"><Sprout size={18} /> Crop Growth Timeline — {stage.crop}</div>
              <StageTimeline stages={stage.all_stages} currentName={stage.current_stage.name} />

              <div style={{
                marginTop: 20, padding: '14px 18px', borderRadius: 10,
                background: stage.current_stage.critical ? 'rgba(255,112,67,0.08)' : 'rgba(102,187,106,0.07)',
                border: `1px solid ${stage.current_stage.critical ? '#ff7043' : '#66bb6a'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stage.current_stage.name}</span>
                  <span style={{ fontSize: '0.8rem', color: '#4a6650' }}>
                    {stage.current_stage.day_range} · {stage.current_stage.days_remaining} days remaining
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ background: 'rgba(67,160,71,0.06)', borderRadius: 6, height: 6, marginBottom: 14 }}>
                  <div style={{
                    width: `${stage.current_stage.progress_pct}%`,
                    background: stage.current_stage.critical ? '#ff7043' : '#66bb6a',
                    borderRadius: 6, height: 6, transition: 'width 0.4s',
                  }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
                  {stage.current_stage.actions.map((a, i) => (
                    <div key={i} style={{ fontSize: '0.83rem', color: '#2e7d32' }}>
                      ▸ {a}
                    </div>
                  ))}
                </div>
                {stage.current_stage.inputs.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {stage.current_stage.inputs.map((inp, i) => (
                      <span key={i} style={{
                        fontSize: '0.74rem', padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(67,160,71,0.07)', border: '1px solid rgba(67,160,71,0.12)',
                      }}>{inp}</span>
                    ))}
                  </div>
                )}
              </div>

              {stage.next_stage && (
                <div style={{ marginTop: 10, fontSize: '0.81rem', color: '#4a6650', paddingLeft: 4 }}>
                  Next stage: <strong style={{ color: '#2e7d32' }}>{stage.next_stage.name}</strong>
                  &nbsp;starts in <strong>{stage.next_stage.starts_in_days} days</strong> ({stage.next_stage.day_range})
                </div>
              )}
            </div>
          )}

          {/* No sowing date info */}
          {(!stage || stage.status !== 'active') && (
            <div className="card mb-24 animate-in" style={{ borderColor: 'rgba(255,179,0,0.3)', background: 'rgba(255,179,0,0.04)' }}>
              <div style={{ color: '#ffb300', fontWeight: 600, marginBottom: 6 }}>Growth Stage Tracking Unavailable</div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#2e7d32' }}>
                {stage?.message || 'Add a sowing date to your field in My Fields to enable the crop calendar and stage-based advisories.'}
              </p>
            </div>
          )}

          {/* ── Advisory cards ───────────────────────────────────────────── */}
          <div className="card mb-24 animate-in">
            <div className="card-title mb-16"><Zap size={18} /> Advisory Cards ({cards.length})</div>
            {cards.length === 0
              ? <p className="text-muted" style={{ fontSize: '0.85rem' }}>No active advisories — all clear.</p>
              : cards.map((c, i) => <AdvisoryCard key={i} card={c} />)
            }
          </div>

          {/* ── Fertilizer schedule ──────────────────────────────────────── */}
          {fert.length > 0 && <FertilizerTable recs={fert} />}
        </>
      )}
    </div>
  );
}
