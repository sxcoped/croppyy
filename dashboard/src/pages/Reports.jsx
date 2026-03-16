import { useState, useEffect } from 'react';
import { FileText, Download, ShieldCheck, CreditCard, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { listFields, getIndices, generateReport } from '../utils/api';
import api from '../utils/api';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card animate-in" style={{ textAlign: 'center' }}>
      <Icon size={28} color={color || 'var(--green-400)'} style={{ marginBottom: 8 }} />
      <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export default function Reports() {
  const [fields,        setFields]        = useState([]);
  const [fieldId,       setFieldId]       = useState('');
  const [activeField,   setActiveField]   = useState(null);
  const [indices,       setIndices]       = useState(null);
  const [loadingIdx,    setLoadingIdx]    = useState(false);

  // Field health PDF
  const [genLoading,    setGenLoading]    = useState(false);

  // PM-FASAL check
  const [fasalYield,    setFasalYield]    = useState('');
  const [fasalResult,   setFasalResult]   = useState(null);
  const [fasalLoading,  setFasalLoading]  = useState(false);

  // Farm record / KCC
  const [farmerName,    setFarmerName]    = useState('');
  const [village,       setVillage]       = useState('');
  const [bankBranch,    setBankBranch]    = useState('');
  const [kccLoading,    setKccLoading]    = useState(false);

  useEffect(() => {
    listFields().then(r => {
      const list = r.data || [];
      setFields(list);
      if (list.length) {
        setFieldId(list[0].id);
        setActiveField(list[0]);
      }
    }).catch(() => {});
  }, []);

  function onFieldChange(id) {
    setFieldId(id);
    const f = fields.find(x => x.id === id);
    setActiveField(f || null);
    setIndices(null);
    setFasalResult(null);
  }

  async function loadIndices() {
    if (!activeField) return;
    setLoadingIdx(true);
    const end   = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    try {
      const r = await getIndices(activeField.lat, activeField.lon, start, end);
      setIndices(r.data);
    } catch { toast.error('Could not load satellite data'); }
    setLoadingIdx(false);
  }

  async function downloadHealthReport() {
    if (!activeField) return;
    setGenLoading(true);
    try {
      const blob = await generateReport({
        field_name:  activeField.name,
        lat:         activeField.lat,
        lon:         activeField.lon,
        crop_type:   activeField.crop_type,
        state:       activeField.state || 'India',
        indices:     indices?.indices || null,
      });
      const url = URL.createObjectURL(new Blob([blob.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `croppy_report_${activeField.name}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded!');
    } catch { toast.error('Report generation failed'); }
    setGenLoading(false);
  }

  async function checkFasal() {
    if (!activeField || !fasalYield) return;
    setFasalLoading(true);
    setFasalResult(null);
    try {
      const r = await api.post('/api/insurance/fasal-check', {
        field_name:       activeField.name,
        crop_type:        activeField.crop_type,
        state:            activeField.state || 'Punjab',
        estimated_yield:  parseFloat(fasalYield),
        area_ha:          activeField.area_ha || 1,
        sowing_date:      activeField.sowing_date || null,
        ndvi_at_flowering: indices?.indices?.NDVI?.value || null,
      });
      setFasalResult(r.data);
    } catch { toast.error('Insurance check failed'); }
    setFasalLoading(false);
  }

  async function downloadFarmRecord() {
    if (!activeField || !farmerName || !village) {
      toast.error('Enter farmer name and village first');
      return;
    }
    setKccLoading(true);
    try {
      const r = await api.post('/api/insurance/farm-record', {
        field_name:       activeField.name,
        farmer_name:      farmerName,
        village,
        district:         activeField.district || 'District',
        state:            activeField.state || 'India',
        area_ha:          activeField.area_ha || 1,
        crop_type:        activeField.crop_type,
        sowing_date:      activeField.sowing_date || null,
        irrigation_type:  activeField.irrigation_type || 'rainfed',
        bank_branch:      bankBranch || null,
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `farm_record_${farmerName.replace(/ /g, '_')}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Farm record downloaded!');
    } catch { toast.error('Failed to generate farm record'); }
    setKccLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Reports & Documents</h1>
        <p>Generate field health reports, PM-FASAL insurance checks, and KCC farm records</p>
      </div>

      {/* Field selector */}
      <div className="card mb-24">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Field</label>
            <select className="input" value={fieldId} onChange={e => onFieldChange(e.target.value)}>
              {fields.map(f => <option key={f.id} value={f.id}>{f.name} — {f.crop_type}</option>)}
            </select>
          </div>
          <button className="btn btn-ghost" onClick={loadIndices} disabled={loadingIdx || !activeField}>
            {loadingIdx ? <Loader size={15} className="spin" /> : null}
            {loadingIdx ? 'Loading…' : 'Load Satellite Data'}
          </button>
          {indices && <span className="badge badge-green">Satellite data loaded</span>}
        </div>
      </div>

      {/* Summary stats */}
      {activeField && (
        <div className="grid-4 mb-24">
          <StatCard icon={FileText}     label="Crop"       value={activeField.crop_type} />
          <StatCard icon={ShieldCheck}  label="Area"       value={activeField.area_ha ? `${activeField.area_ha} ha` : '—'} color="#26c6da" />
          <StatCard icon={CreditCard}   label="State"      value={activeField.state || '—'} color="#ffb300" />
          <StatCard icon={FileText}     label="Irrigation" value={activeField.irrigation_type || '—'} color="#ab47bc" />
        </div>
      )}

      {/* ── Section 1: Field Health Report ─────────────────────────────── */}
      <div className="card mb-24 animate-in">
        <div className="card-header">
          <div className="card-title"><FileText size={18} /> Field Health PDF Report</div>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#2e7d32', margin: '8px 0 16px' }}>
          Generates a professionally formatted PDF with all 8 vegetation indices, satellite metadata, and crop summary.
          Load satellite data first for a richer report.
        </p>
        {indices && (
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {['NDVI', 'EVI', 'NDWI', 'NDRE'].map(k => {
              const v = indices.indices?.[k];
              return (
                <div key={k} style={{ textAlign: 'center', padding: '8px', background: 'rgba(67,160,71,0.04)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: '#4a6650' }}>{k}</div>
                  <div style={{ fontWeight: 700 }}>{v?.value?.toFixed(3) ?? '—'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#4a6650' }}>{v?.health_zone}</div>
                </div>
              );
            })}
          </div>
        )}
        <button className="btn btn-primary" onClick={downloadHealthReport} disabled={genLoading || !activeField}>
          {genLoading ? <Loader size={15} className="spin" /> : <Download size={15} />}
          {genLoading ? 'Generating…' : 'Download Report PDF'}
        </button>
      </div>

      {/* ── Section 2: PM-FASAL Insurance ──────────────────────────────── */}
      <div className="card mb-24 animate-in">
        <div className="card-header">
          <div className="card-title"><ShieldCheck size={18} /> PM-FASAL Insurance Eligibility</div>
          <span className="badge" style={{ background: 'rgba(102,187,106,0.12)', color: '#66bb6a', border: '1px solid #66bb6a' }}>
            PMFBY
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#2e7d32', margin: '8px 0 16px' }}>
          Check if your field qualifies for a PM Fasal Bima Yojana claim based on estimated yield
          vs. historical district averages. A shortfall above 20% triggers eligibility.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <label>Estimated Yield (kg/ha)</label>
            <input
              className="input" type="number" placeholder="e.g. 3200"
              value={fasalYield} onChange={e => setFasalYield(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <button className="btn btn-primary" onClick={checkFasal} disabled={fasalLoading || !fasalYield || !activeField}>
            {fasalLoading ? <Loader size={15} className="spin" /> : <ShieldCheck size={15} />}
            {fasalLoading ? 'Checking…' : 'Check Eligibility'}
          </button>
        </div>

        {fasalResult && (
          <div style={{
            padding: '16px 20px', borderRadius: 12,
            background: fasalResult.eligible ? 'rgba(102,187,106,0.08)' : 'rgba(67,160,71,0.04)',
            border: `1px solid ${fasalResult.eligible ? '#66bb6a' : 'rgba(67,160,71,0.1)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {fasalResult.eligible
                ? <CheckCircle size={22} color="#66bb6a" />
                : <AlertTriangle size={22} color="#ffb300" />}
              <span style={{ fontWeight: 700, fontSize: '1rem', color: fasalResult.eligible ? '#66bb6a' : '#ffb300' }}>
                {fasalResult.eligible ? 'Eligible for PM-FASAL Claim' : 'Not Eligible'}
              </span>
            </div>
            <div className="grid-3" style={{ marginBottom: 12 }}>
              {[
                { label: 'Your Yield',    value: `${fasalResult.estimated_yield} kg/ha` },
                { label: 'District Avg',  value: `${fasalResult.historical_avg} kg/ha` },
                { label: 'Shortfall',     value: `${fasalResult.shortfall_pct}%`, highlight: fasalResult.shortfall_pct >= 20 },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(67,160,71,0.04)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: '#4a6650', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: highlight ? '#66bb6a' : undefined }}>{value}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.84rem', color: '#2e7d32', margin: '0 0 10px' }}>
              {fasalResult.status_message}
            </p>
            {fasalResult.next_steps?.length > 0 && (
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {fasalResult.next_steps.map((s, i) => (
                  <li key={i} style={{ fontSize: '0.81rem', color: '#2e7d32', marginBottom: 4 }}>{s}</li>
                ))}
              </ul>
            )}
            {fasalResult.eligible && (
              <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#4a6650' }}>
                Helpline: <strong>{fasalResult.helpline}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 3: Farm Record / KCC ────────────────────────────────── */}
      <div className="card animate-in">
        <div className="card-header">
          <div className="card-title"><CreditCard size={18} /> Farm Record for KCC / Crop Loan</div>
          <span className="badge" style={{ background: 'rgba(38,198,218,0.12)', color: '#26c6da', border: '1px solid #26c6da' }}>
            PDF
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#2e7d32', margin: '8px 0 16px' }}>
          Generate a farm land record PDF for Kisan Credit Card (KCC) or crop loan applications.
          This document includes field boundary data, crop details, and area measured from satellite imagery.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <label>Farmer Name *</label>
            <input className="input" placeholder="Full name" value={farmerName} onChange={e => setFarmerName(e.target.value)} />
          </div>
          <div>
            <label>Village *</label>
            <input className="input" placeholder="Village name" value={village} onChange={e => setVillage(e.target.value)} />
          </div>
          <div>
            <label>Bank Branch (optional)</label>
            <input className="input" placeholder="For KCC application" value={bankBranch} onChange={e => setBankBranch(e.target.value)} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={downloadFarmRecord} disabled={kccLoading || !farmerName || !village}>
          {kccLoading ? <Loader size={15} className="spin" /> : <Download size={15} />}
          {kccLoading ? 'Generating…' : 'Download Farm Record PDF'}
        </button>
        <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
          The generated PDF must be co-signed by a revenue official (Patwari / Village Accountant) for formal bank submission.
        </p>
      </div>
    </div>
  );
}
