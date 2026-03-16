import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from 'react-leaflet';
import { Leaf, Droplets, TrendingUp, CloudRain, AlertTriangle, CheckCircle, MapPin, RefreshCw, Thermometer, Zap, Clock } from 'lucide-react';
import {
  listFields, getIndices, getTimeseries, getSoilMoisture,
  getRainfall, getLandSurfaceTemp, getZoneMap,
  getCurrentWeather, getForecast, getAlerts,
} from '../utils/api';
import 'leaflet/dist/leaflet.css';

/* ─── pure helpers ──────────────────────────────────────────────────── */
function zoneColor(z) {
  return { Critical: '#ef5350', Poor: '#ff7043', Moderate: '#ffb300', Good: '#66bb6a', Excellent: '#26a69a' }[z] || '#6b8a72';
}

function weatherEmoji(desc = '') {
  const d = desc.toLowerCase();
  if (d.includes('thunder') || d.includes('storm')) return '⛈️';
  if (d.includes('rain') || d.includes('shower') || d.includes('drizzle')) return '🌧️';
  if (d.includes('cloud') || d.includes('overcast')) return '☁️';
  if (d.includes('clear') || d.includes('sunny')) return '☀️';
  if (d.includes('mist') || d.includes('fog') || d.includes('haze')) return '🌫️';
  if (d.includes('snow')) return '❄️';
  return '🌤️';
}

function dayAbbr(dateStr) {
  if (!dateStr) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateStr).getDay()];
}

function deriveOverallStatus(indices) {
  if (!indices?.indices) return null;
  const zones = Object.values(indices.indices).map(v => v.health_zone).filter(Boolean);
  if (zones.includes('Critical')) return { label: 'Critical', color: '#ef5350', emoji: '🚨', advice: 'Your field is in critical condition — take action today.' };
  if (zones.includes('Poor'))     return { label: 'Needs Attention', color: '#ff7043', emoji: '⚠️', advice: 'Some parts of your field are struggling — check and act soon.' };
  if (zones.includes('Moderate')) return { label: 'Watch Closely', color: '#ffb300', emoji: '👁️', advice: 'Field is okay but keep a close eye this week.' };
  return                                 { label: 'Good', color: '#66bb6a', emoji: '✅', advice: 'Your field looks healthy! Keep up the good work.' };
}

function deriveWaterStatus(soilMoisture, lst) {
  const sm   = soilMoisture?.surface_sm;
  const cwsi = lst?.cwsi;
  if (sm != null) {
    if (sm > 50)  return { label: 'Waterlogged', color: '#26c6da', advice: 'Too much water in soil — hold off on irrigation.' };
    if (sm < 10)  return { label: 'Very Dry',    color: '#ef5350', advice: 'Soil is very dry — irrigate as soon as possible.' };
    if (sm < 25)  return { label: 'Getting Dry', color: '#ffb300', advice: 'Moisture is low — plan to irrigate in 2–3 days.' };
    return               { label: 'Adequate',    color: '#66bb6a', advice: 'Soil has enough moisture right now.' };
  }
  if (cwsi != null) {
    if (cwsi > 0.5)  return { label: 'Very Dry',    color: '#ef5350', advice: 'Crops urgently need water.' };
    if (cwsi > 0.25) return { label: 'Getting Dry', color: '#ffb300', advice: 'Plan to irrigate soon.' };
    return                  { label: 'Adequate',    color: '#66bb6a', advice: 'Crops are well watered.' };
  }
  return null;
}

function deriveGrowthStatus(timeseries) {
  if (!timeseries?.length) return null;
  const recent = timeseries.slice(-5).map(d => d.ndvi ?? 0);
  const older  = timeseries.slice(-15, -5).map(d => d.ndvi ?? 0);
  const avg = arr => arr.reduce((s, v) => s + v, 0) / Math.max(arr.length, 1);
  const change = avg(recent) - avg(older);
  if (change >  0.05) return { label: 'Growing Well', color: '#66bb6a', advice: 'Crop is developing nicely — on a good track.' };
  if (change < -0.05) return { label: 'Slowing Down', color: '#ff7043', advice: 'Crop growth is declining — check for stress or disease.' };
  return                     { label: 'On Track',     color: '#66bb6a', advice: 'Growth is steady and normal for this period.' };
}

const GROWTH_STAGES = {
  wheat:   ['Sowing', 'Germination', 'Tillering', 'Jointing', 'Heading', 'Harvest'],
  rice:    ['Sowing', 'Germination', 'Tillering', 'Heading', 'Grain Fill', 'Harvest'],
  cotton:  ['Sowing', 'Germination', 'Squaring', 'Flowering', 'Boll Dev.', 'Harvest'],
  maize:   ['Sowing', 'Germination', 'Vegetative', 'Tasseling', 'Grain Fill', 'Harvest'],
  default: ['Sowing', 'Germination', 'Vegetative', 'Flowering', 'Grain Fill', 'Harvest'],
};

/* ─── small UI pieces ───────────────────────────────────────────────── */
function SkeletonBox({ h = 80, radius = 14 }) {
  return (
    <div style={{
      height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#1c2723 25%,#22302a 50%,#1c2723 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}

function MetricCard({ icon: Icon, label, status, statusColor, advice, loading }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: (statusColor || '#66bb6a') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={statusColor || '#66bb6a'} />
      </div>
      {loading
        ? <div style={{ flex: 1 }}><SkeletonBox h={16} radius={6} /><div style={{ marginTop: 6 }}><SkeletonBox h={12} radius={4} /></div></div>
        : <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#4a6650', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: statusColor || '#66bb6a', marginBottom: 3 }}>{status || '—'}</div>
            <div style={{ fontSize: '0.75rem', color: '#4a6650', lineHeight: 1.4 }}>{advice}</div>
          </div>
      }
    </div>
  );
}

function AlertCard({ type, message, action }) {
  const colors = { danger: '#ef5350', warn: '#ffb300', info: '#26c6da', good: '#66bb6a' };
  const c = colors[type] || colors.info;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: c + '10', border: `1px solid ${c}30`, borderRadius: 12 }}>
      <div style={{ marginTop: 1, flexShrink: 0 }}>
        {type === 'danger' ? <AlertTriangle size={16} color={c} /> : type === 'good' ? <CheckCircle size={16} color={c} /> : <Zap size={16} color={c} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85rem', color: '#1b5e20', lineHeight: 1.5 }}>{message}</div>
        {action && <div style={{ fontSize: '0.75rem', color: c, fontWeight: 600, marginTop: 4 }}>→ {action}</div>}
      </div>
    </div>
  );
}

/* ─── main component ────────────────────────────────────────────────── */
export default function FieldHealth() {
  const [fields,       setFields]       = useState([]);
  const [selectedField,setSelectedField]= useState(null);
  const [loading,      setLoading]      = useState(false);
  const [lastChecked,  setLastChecked]  = useState(null);
  const [historyRange, setHistoryRange] = useState(30);

  // data
  const [indices,      setIndices]      = useState(null);
  const [timeseries,   setTimeseries]   = useState([]);
  const [soilMoisture, setSoilMoisture] = useState(null);
  const [rainfall,     setRainfall]     = useState(null);
  const [lst,          setLst]          = useState(null);
  const [zoneMap,      setZoneMap]      = useState(null);
  const [weather,      setWeather]      = useState(null);
  const [forecast,     setForecast]     = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [growthStage,  setGrowthStage]  = useState(null);

  useEffect(() => {
    listFields().then(r => {
      const list = r.data || [];
      setFields(list);
      if (list.length) selectField(list[0]);
    }).catch(() => {});
    getAlerts().then(r => setAlerts(r.data || [])).catch(() => {});
  }, []);

  function selectField(f) {
    setSelectedField(f);
    setIndices(null); setTimeseries([]); setSoilMoisture(null);
    setRainfall(null); setLst(null); setZoneMap(null);
    runAnalysis(f);
  }

  async function runAnalysis(f) {
    if (!f) return;
    setLoading(true);
    const la = parseFloat(f.lat), lo = parseFloat(f.lon);
    const end   = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const [idxR, tsR, smR, rainR, lstR, zoneR, wxR, fcR] = await Promise.allSettled([
      getIndices(la, lo, start, end),
      getTimeseries(la, lo, start, end),
      getSoilMoisture(la, lo, start, end),
      getRainfall(la, lo, start, end, f.polygon || null),
      getLandSurfaceTemp(la, lo, start, end, f.polygon || null),
      getZoneMap(la, lo, start, end, f.polygon || null),
      getCurrentWeather(la, lo),
      getForecast(la, lo),
    ]);

    if (idxR.status  === 'fulfilled') setIndices(idxR.value.data);
    if (tsR.status   === 'fulfilled') setTimeseries(tsR.value.data.points || []);
    if (smR.status   === 'fulfilled') setSoilMoisture(smR.value.data);
    if (rainR.status === 'fulfilled') setRainfall(rainR.value.data);
    if (lstR.status  === 'fulfilled') setLst(lstR.value.data);
    if (zoneR.status === 'fulfilled') setZoneMap(zoneR.value.data);
    if (wxR.status   === 'fulfilled') setWeather(wxR.value.data);
    if (fcR.status   === 'fulfilled') setForecast(fcR.value.data?.forecast?.slice(0, 5) || []);

    setLastChecked(new Date());
    setLoading(false);
  }

  // derived
  const overallStatus  = deriveOverallStatus(indices);
  const waterStatus    = deriveWaterStatus(soilMoisture, lst);
  const growthProgress = deriveGrowthStatus(timeseries);
  const cropType       = selectedField?.crop_type?.toLowerCase() || 'default';
  const stages         = GROWTH_STAGES[cropType] || GROWTH_STAGES.default;

  // estimate current stage from NDVI
  const ndviAvg = timeseries.length
    ? timeseries.slice(-5).reduce((s, d) => s + (d.ndvi || 0), 0) / 5
    : null;
  const currentStageIdx = ndviAvg === null ? 2
    : ndviAvg < 0.15 ? 0
    : ndviAvg < 0.25 ? 1
    : ndviAvg < 0.45 ? 2
    : ndviAvg < 0.65 ? 3
    : ndviAvg < 0.75 ? 4
    : 5;

  // history filtered
  const historyData = timeseries.slice(-(historyRange === 30 ? 6 : 18));

  // zone map features
  const zoneFeatures = zoneMap?.features || [];
  const hotspotCount = zoneFeatures.filter(f => f.properties?.is_stress_hotspot).length;

  // smart alerts — combine API alerts + derived ones
  const derivedAlerts = [];
  if (overallStatus?.label === 'Critical')
    derivedAlerts.push({ type: 'danger', message: 'Critical crop stress detected across your field.', action: 'Check for disease or severe water shortage today' });
  if (waterStatus?.label === 'Very Dry')
    derivedAlerts.push({ type: 'danger', message: 'Soil is very dry — crops are at risk of wilting.', action: 'Irrigate as soon as possible' });
  if (waterStatus?.label === 'Getting Dry')
    derivedAlerts.push({ type: 'warn', message: 'Soil moisture is running low.', action: 'Plan irrigation within 2–3 days' });
  if (hotspotCount > 0)
    derivedAlerts.push({ type: 'warn', message: `${hotspotCount} weak spot${hotspotCount > 1 ? 's' : ''} found in your field — some areas are struggling.`, action: 'Visit those areas and check for pests or disease' });
  const apiAlerts = (alerts || []).slice(0, 3).map(a => ({
    type: a.severity === 'critical' ? 'danger' : a.severity === 'high' ? 'warn' : 'info',
    message: a.message || a.title,
    action: a.recommendation,
  }));
  const allAlerts = [...derivedAlerts, ...apiAlerts];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .fh-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Field picker ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <select
            className="input"
            value={selectedField?.id || ''}
            onChange={e => { const f = fields.find(x => x.id === e.target.value); if (f) selectField(f); }}
            style={{ fontWeight: 600 }}
          >
            {fields.map(f => <option key={f.id} value={f.id}>{f.name} — {f.crop_type}</option>)}
            {fields.length === 0 && <option>No fields yet — add one first</option>}
          </select>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => selectedField && runAnalysis(selectedField)}
          disabled={loading || !selectedField}
          style={{ gap: 6, flexShrink: 0 }}
        >
          <RefreshCw size={14} className={loading ? 'fh-spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        {lastChecked && (
          <div style={{ fontSize: '0.75rem', color: '#4a6650', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <Clock size={12} /> Updated {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* ── Overview card ── */}
      {selectedField && (
        <div style={{
          background: overallStatus ? `linear-gradient(135deg, var(--bg-card) 60%, ${overallStatus.color}18)` : 'var(--bg-card)',
          border: `1px solid ${overallStatus ? overallStatus.color + '30' : 'var(--border-subtle)'}`,
          borderRadius: 18, padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#43a04720', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Leaf size={18} color="#66bb6a" />
                </div>
                <div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1b5e20', lineHeight: 1.1 }}>{selectedField.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#4a6650', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} /> {selectedField.location || `${selectedField.lat?.toFixed(3)}, ${selectedField.lon?.toFixed(3)}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14 }}>
                <div style={{ fontSize: '0.8rem', color: '#4a6650' }}>🌾 <strong style={{ color: '#1b5e20' }}>{selectedField.crop_type || 'Unknown crop'}</strong></div>
                {selectedField.area_acres && <div style={{ fontSize: '0.8rem', color: '#4a6650' }}>📐 <strong style={{ color: '#1b5e20' }}>{selectedField.area_acres} acres</strong></div>}
                {selectedField.sowing_date && <div style={{ fontSize: '0.8rem', color: '#4a6650' }}>📅 Sown <strong style={{ color: '#1b5e20' }}>{new Date(selectedField.sowing_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong></div>}
                <div style={{ fontSize: '0.8rem', color: '#4a6650' }}>🌱 Currently in <strong style={{ color: '#66bb6a' }}>{stages[currentStageIdx] || 'Unknown'} stage</strong></div>
              </div>
            </div>

            {/* big status badge */}
            {loading && !overallStatus
              ? <div style={{ width: 140 }}><SkeletonBox h={70} radius={14} /></div>
              : overallStatus && (
                <div style={{
                  textAlign: 'center', flexShrink: 0,
                  background: overallStatus.color + '15',
                  border: `1.5px solid ${overallStatus.color}40`,
                  borderRadius: 16, padding: '16px 24px', minWidth: 140,
                }}>
                  <div style={{ fontSize: '2rem', lineHeight: 1, marginBottom: 6 }}>{overallStatus.emoji}</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: overallStatus.color, lineHeight: 1.15 }}>{overallStatus.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#4a6650', marginTop: 4, maxWidth: 120 }}>{overallStatus.advice}</div>
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ── Health map + metric cards ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>

        {/* Health map */}
        <div style={{ flex: '1 1 320px', minWidth: 280, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Field Health Map</div>
              <div style={{ fontSize: '0.75rem', color: '#4a6650', marginTop: 2 }}>Tap any spot to see details</div>
            </div>
            {hotspotCount > 0 && (
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ff7043', background: '#ff704318', borderRadius: 8, padding: '4px 10px' }}>
                ⚠ {hotspotCount} problem spot{hotspotCount > 1 ? 's' : ''}
              </div>
            )}
            {hotspotCount === 0 && zoneFeatures.length > 0 && (
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#66bb6a', background: '#66bb6a18', borderRadius: 8, padding: '4px 10px' }}>
                ✅ All clear
              </div>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 340, position: 'relative' }}>
            {loading && !zoneMap
              ? (
                <div style={{ height: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#4a6650' }}>
                  <RefreshCw size={28} color="#66bb6a" className="fh-spin" />
                  <div style={{ fontSize: '0.85rem' }}>Analysing your field from space…</div>
                </div>
              ) : selectedField
              ? (
                <MapContainer
                  center={[parseFloat(selectedField.lat), parseFloat(selectedField.lon)]}
                  zoom={14} style={{ height: 340, width: '100%' }}
                >
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri" />
                  {zoneFeatures.map((feat, i) => {
                    const coords = feat.geometry?.coordinates?.[0] || [];
                    if (!coords.length) return null;
                    const cLon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
                    const cLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
                    const zone = feat.properties?.health_zone;
                    const isHot = feat.properties?.is_stress_hotspot;
                    const color = zoneColor(zone);
                    return (
                      <CircleMarker key={i} center={[cLat, cLon]} radius={isHot ? 9 : 5}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.78, weight: isHot ? 2 : 1 }}>
                        <LTooltip>
                          <div style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
                            <strong>{zone}</strong>
                            {isHot && <><br /><span style={{ color: '#ef5350' }}>⚠ Visit this spot</span></>}
                          </div>
                        </LTooltip>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              )
              : (
                <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6650', fontSize: '0.85rem' }}>
                  Select a field to see the map
                </div>
              )
            }
          </div>

          {/* legend */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[['#ef5350','Problem'],['#ffb300','Watch'],['#66bb6a','Healthy'],['#26a69a','Excellent']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: '#4a6650' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: c }} /> {l}
              </div>
            ))}
          </div>
        </div>

        {/* 3 metric cards */}
        <div style={{ flex: '0 1 280px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MetricCard
            icon={Leaf}
            label="Crop Health"
            status={overallStatus?.label}
            statusColor={overallStatus?.color}
            advice={overallStatus?.advice || 'Waiting for satellite data…'}
            loading={loading && !indices}
          />
          <MetricCard
            icon={Droplets}
            label="Water Status"
            status={waterStatus?.label}
            statusColor={waterStatus?.color}
            advice={waterStatus?.advice || 'Checking soil moisture…'}
            loading={loading && !soilMoisture && !lst}
          />
          <MetricCard
            icon={TrendingUp}
            label="Growth Progress"
            status={growthProgress?.label}
            statusColor={growthProgress?.color}
            advice={growthProgress?.advice || 'Checking growth trend…'}
            loading={loading && !timeseries.length}
          />
          {/* rainfall mini card */}
          {(rainfall || loading) && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '14px 18px' }}>
              {loading && !rainfall
                ? <SkeletonBox h={40} radius={8} />
                : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CloudRain size={18} color="#26c6da" />
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#4a6650', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Rain (last 90 days)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#26c6da', marginTop: 2 }}>
                        {rainfall?.total_mm} mm
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#4a6650', marginLeft: 6 }}>{rainfall?.avg_daily_mm} mm/day avg</span>
                      </div>
                    </div>
                  </div>
                )
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Alerts & actions ── */}
      {(allAlerts.length > 0 || loading) && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="#ffb300" /> What To Do Today
          </div>
          {loading && allAlerts.length === 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><SkeletonBox h={52} /><SkeletonBox h={52} /></div>
            : allAlerts.length === 0
            ? <AlertCard type="good" message="All clear — no urgent actions right now. Your field is doing well!" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allAlerts.map((a, i) => <AlertCard key={i} {...a} />)}
              </div>
          }
        </div>
      )}

      {/* ── Weather + Growth timeline ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        {/* Weather */}
        <div style={{ flex: '1 1 280px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Thermometer size={16} color="#ff7043" /> Today's Weather
          </div>
          {loading && !weather
            ? <SkeletonBox h={80} />
            : weather
            ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{weatherEmoji(weather.description)}</div>
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ff7043', lineHeight: 1 }}>{weather.temp_c ?? weather.temperature}°C</div>
                    <div style={{ fontSize: '0.8rem', color: '#4a6650', marginTop: 3, textTransform: 'capitalize' }}>{weather.description || 'Clear'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#4a6650', marginTop: 2 }}>
                      {weather.humidity != null && `💧 ${weather.humidity}% humidity`}
                      {weather.wind_speed != null && ` · 💨 ${weather.wind_speed} km/h`}
                    </div>
                  </div>
                </div>
                {forecast.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                    {forecast.map((d, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: '#4a6650', fontWeight: 600, marginBottom: 4 }}>{dayAbbr(d.date)}</div>
                        <div style={{ fontSize: '1.1rem' }}>{weatherEmoji(d.description)}</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1b5e20', marginTop: 4 }}>
                          {d.max_c ?? d.temp_max ?? d.temperature ?? '—'}°
                        </div>
                        {d.rain_mm > 0 && <div style={{ fontSize: '0.65rem', color: '#26c6da', marginTop: 2 }}>{d.rain_mm}mm</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
            : <div style={{ fontSize: '0.82rem', color: '#4a6650' }}>Weather data not available</div>
          }
        </div>

        {/* Growth timeline */}
        <div style={{ flex: '1 1 280px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Leaf size={16} color="#66bb6a" /> Crop Lifecycle
          </div>
          <div style={{ fontSize: '0.78rem', color: '#4a6650', marginBottom: 20 }}>
            Where your <strong style={{ color: '#1b5e20' }}>{selectedField?.crop_type || 'crop'}</strong> is right now
          </div>

          {/* stages row */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {stages.map((stage, i) => {
              const isPast    = i < currentStageIdx;
              const isCurrent = i === currentStageIdx;
              const isFuture  = i > currentStageIdx;
              return (
                <div key={stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  {/* connector line */}
                  {i < stages.length - 1 && (
                    <div style={{ position: 'absolute', top: 10, left: '50%', width: '100%', height: 2, background: isPast || isCurrent ? '#66bb6a' : 'var(--border-subtle)', zIndex: 0 }} />
                  )}
                  {/* dot */}
                  <div style={{
                    width: isCurrent ? 22 : 14, height: isCurrent ? 22 : 14,
                    borderRadius: '50%', zIndex: 1, flexShrink: 0,
                    background: isCurrent ? '#66bb6a' : isPast ? '#2e7d32' : 'var(--bg-elevated)',
                    border: isCurrent ? '3px solid #a5d6a7' : isPast ? '2px solid #2e7d32' : '2px solid var(--border-medium)',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(102,187,106,0.2)' : 'none',
                    transition: 'all 0.3s ease',
                  }} />
                  {/* label */}
                  <div style={{
                    fontSize: isCurrent ? '0.68rem' : '0.62rem',
                    fontWeight: isCurrent ? 700 : 400,
                    color: isCurrent ? '#66bb6a' : isPast ? '#4a6650' : 'var(--text-dim)',
                    textAlign: 'center', marginTop: 8, lineHeight: 1.3,
                  }}>
                    {stage}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, padding: '10px 14px', background: '#66bb6a12', borderRadius: 10, fontSize: '0.82rem', color: '#66bb6a', fontWeight: 600 }}>
            🌱 Currently: <span style={{ color: '#1b5e20' }}>{stages[currentStageIdx]} stage</span>
            {currentStageIdx < stages.length - 1 && (
              <span style={{ fontWeight: 400, color: '#4a6650', marginLeft: 6 }}>
                — next: {stages[currentStageIdx + 1]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── History chart ── */}
      {timeseries.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>How Has My Field Changed?</div>
              <div style={{ fontSize: '0.75rem', color: '#4a6650', marginTop: 2 }}>
                Higher = greener, healthier crops. A dip may signal disease, drought, or pest damage starting.
              </div>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, gap: 2 }}>
              {[30, 90].map(d => (
                <button key={d} onClick={() => setHistoryRange(d)} style={{
                  padding: '5px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600,
                  background: historyRange === d ? '#43a047' : 'transparent',
                  color: historyRange === d ? '#fff' : '#4a6650',
                  transition: 'all 150ms',
                }}>
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 220, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#66bb6a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#66bb6a" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(67,160,71,0.07)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b8a72' }} tickFormatter={d => d?.slice(5)} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#6b8a72' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1)} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid rgba(67,160,71,0.2)', borderRadius: 8, fontSize: 12 }}
                  formatter={v => [v?.toFixed(3), 'Crop Greenness']}
                  labelStyle={{ color: '#a5d6a7', marginBottom: 4 }}
                />
                <Area type="monotone" dataKey="ndvi" stroke="#66bb6a" fill="url(#histGrad)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !selectedField && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#4a6650' }}>
          <Leaf size={48} color="#2e7d32" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>No fields added yet</div>
          <div style={{ fontSize: '0.85rem' }}>Go to "My Fields" and add your field first — then come back here to see your crop health.</div>
        </div>
      )}
    </div>
  );
}
