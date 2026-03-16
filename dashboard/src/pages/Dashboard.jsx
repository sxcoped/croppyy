import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Polygon, ImageOverlay } from 'react-leaflet';
import {
  Activity, Droplets, Thermometer, Wind, CloudRain,
  TrendingUp, ChevronRight, Zap, MapPin, Sprout, Bell,
  AlertTriangle, CheckCircle, Layers, Calendar, Eye, RefreshCw,
  X, HelpCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  listFields, getIndices, getCurrentWeather, getTimeseries,
  getAlerts, getAdvisory, getForecast, getRainfall, getSoilMoisture,
  getMarketPrices, getAlertSummary, getThumbnail, getIndexThumbnail, acknowledgeAlert,
} from '../utils/api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Constants ─────────────────────────────────────────────────────────────────
const ZONE_COLOR = {
  Critical: '#ef5350', Poor: '#ff7043', Moderate: '#ffb300',
  Good: '#66bb6a', Excellent: '#26a69a',
};
const INDEX_TABS = ['NDVI','EVI','NDWI','NDRE','SAVI','BSI','NDMI','True Color'];
const INDEX_META = {
  NDVI: { label: 'Normalized Difference Vegetation Index', color: '#66bb6a' },
  EVI:  { label: 'Enhanced Vegetation Index',              color: '#26c6da' },
  NDWI: { label: 'Normalized Difference Water Index',      color: '#42a5f5' },
  NDRE: { label: 'Red-Edge Chlorophyll Index',             color: '#ab47bc' },
  SAVI: { label: 'Soil-Adjusted Vegetation Index',         color: '#8bc34a' },
  BSI:  { label: 'Bare Soil Index',                        color: '#ff8a65' },
  NDMI: { label: 'Normalized Difference Moisture Index',   color: '#4dd0e1' },
};
const WX_ICONS = {
  Clear:'☀️', Clouds:'☁️', Rain:'🌧️', Drizzle:'🌦️',
  Thunderstorm:'⛈️', Snow:'🌨️', Mist:'🌫️', Fog:'🌫️',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const zoneColor = (z) => ZONE_COLOR[z] || '#6b8a72';
const fmt = (n, d = 2) => n != null ? (+n).toFixed(d) : '—';

function polygonCentroid(pts) {
  if (!pts?.length) return null;
  return {
    lat: pts.reduce((s, p) => s + p[0], 0) / pts.length,
    lon: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  };
}
function polygonBounds(pts) {
  if (!pts?.length) return null;
  const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
}

// ── Explanation Modal ─────────────────────────────────────────────────────────
function ExplainModal({ data, onClose }) {
  if (!data) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          border: '1px solid rgba(67,160,71,0.25)',
          borderRadius: 18,
          width: '100%', maxWidth: 680,
          maxHeight: '82vh', overflowY: 'auto',
          padding: '28px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{data.title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(67,160,71,0.07)', border: '1px solid rgba(67,160,71,0.12)',
              borderRadius: 8, color: '#4a6650', cursor: 'pointer',
              padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem',
            }}
          >
            <X size={13} /> Close
          </button>
        </div>
        {/* Modal body */}
        <div style={{ fontSize: '0.88rem', lineHeight: 1.75, color: '#4a6650' }}>
          {data.content}
        </div>
      </div>
    </div>
  );
}

// ── Explanation content builders ──────────────────────────────────────────────
function Block({ children, color = '#66bb6a' }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: `${color}12`, border: `1px solid ${color}35`, marginBottom: 14 }}>
      {children}
    </div>
  );
}
function Dot({ color }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 8, flexShrink: 0 }} />;
}
function RangeRow({ label, color, note }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
      <Dot color={color} />
      <div style={{ flex: 1 }}>
        <strong style={{ color }}>{label}</strong>
        {note && <span style={{ color: '#4a6650' }}> — {note}</span>}
      </div>
    </div>
  );
}
function Tip({ children }) {
  return (
    <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(67,160,71,0.04)', fontSize: '0.82rem', color: '#4a6650', borderLeft: '3px solid rgba(102,187,106,0.4)' }}>
      💡 {children}
    </div>
  );
}
function SectionHeading({ children }) {
  return <div style={{ fontWeight: 700, color: '#1b5e20', fontSize: '0.93rem', marginBottom: 10, marginTop: 18 }}>{children}</div>;
}

function buildExplainNdvi(value, zone, crop) {
  const v = value != null ? +value : null;
  let interp = '';
  if (v === null) interp = 'No satellite data available yet.';
  else if (v >= 0.7) interp = 'Your crop has a thick, dense, very healthy canopy. Photosynthesis is running at full speed. No action needed.';
  else if (v >= 0.5) interp = 'Your crop is developing well with a solid green canopy. Growth is on track.';
  else if (v >= 0.3) interp = 'Some stress is visible from space. Leaves may be thinning or yellowing. Investigate for water shortage, pests, or nutrient gaps.';
  else if (v >= 0.1) interp = 'Significant stress detected. Poor canopy cover — possible drought, disease, or fertilizer deficiency. Act quickly.';
  else interp = 'Very little or no crop visible. Either the crop is newly sown, or there is serious damage.';
  return (
    <>
      <p>NDVI stands for <strong>Normalized Difference Vegetation Index</strong> — think of it as a <strong>greenness score</strong> for your field measured from space.</p>
      <p style={{ marginTop: 10 }}>Healthy plants absorb red sunlight to power photosynthesis, and reflect infrared light back. Stressed or sparse plants do the opposite. Satellites measure this difference and give a score from <strong>−1 to +1</strong>. Bare soil sits around 0, and a lush healthy crop sits at 0.5–0.8.</p>

      {v != null && (
        <Block color={zoneColor(zone)}>
          <strong style={{ color: zoneColor(zone) }}>Your field right now ({fmt(v, 3)} → {zone}):</strong><br />
          <span style={{ marginTop: 4, display: 'block' }}>{interp}</span>
        </Block>
      )}

      <SectionHeading>Score guide for {crop || 'crops'}:</SectionHeading>
      <RangeRow label="0.7 – 1.0" color="#26a69a" note="Excellent — dense, lush canopy. Maximum crop health." />
      <RangeRow label="0.5 – 0.7" color="#66bb6a" note="Good — crop growing well. Normal for mid-season." />
      <RangeRow label="0.3 – 0.5" color="#ffb300" note="Moderate — some stress. Check water, pests, or fertilizer." />
      <RangeRow label="0.1 – 0.3" color="#ff7043" note="Poor — clear stress. Irrigate, fertilize, or scout for disease." />
      <RangeRow label="Below 0.1" color="#ef5350" note="Critical — very sparse or damaged crop. Urgent investigation." />

      <Tip>NDVI fluctuates naturally with seasons. Use the Vegetation Trend chart to spot unusual drops vs. normal seasonal changes.</Tip>
    </>
  );
}

function buildExplainEvi(value, zone) {
  return (
    <>
      <p>EVI (Enhanced Vegetation Index) does the same job as NDVI — it measures how green and healthy your crop is — but it is <strong>more accurate for dense or tall crops</strong> like paddy, sugarcane, and maize.</p>
      <p style={{ marginTop: 10 }}>Regular NDVI can "max out" when crops are very thick, giving the same score regardless of whether they're doing great or just okay. EVI adds a blue-light measurement to correct for this and for atmospheric haze.</p>

      {zone && (
        <Block color={zoneColor(zone)}>
          <strong style={{ color: zoneColor(zone) }}>Current status: {zone}</strong>
          {value != null && <span style={{ color: '#4a6650', marginLeft: 8 }}>(EVI = {fmt(value, 3)})</span>}
        </Block>
      )}

      <SectionHeading>What to do with this information:</SectionHeading>
      <p>The "Crop Health" KPI uses EVI zone to give you a simple one-word summary. If it says <strong style={{ color: '#26a69a' }}>Excellent</strong> or <strong style={{ color: '#66bb6a' }}>Good</strong> — your crop is fine. If it says <strong style={{ color: '#ffb300' }}>Moderate</strong> or worse, check your NDRE card (nitrogen) and NDWI card (water stress) to pinpoint the issue.</p>
      <Tip>Once your crop reaches knee height, trust EVI over NDVI as your primary health indicator.</Tip>
    </>
  );
}

function buildExplainWeather(wx, fcDays) {
  const temp = wx?.temp_c, hum = wx?.humidity_pct, wind = wx?.wind_kph, rain = wx?.rainfall_mm ?? 0;
  const fcRain = (fcDays || []).reduce((s, d) => s + (d.rain_mm ?? d.rain?.['3h'] ?? 0), 0);
  return (
    <>
      <p>Weather has a direct and immediate impact on your crop every single day. Here is what today's readings mean in practical terms:</p>

      {temp != null && (
        <Block color={temp > 35 ? '#ef5350' : temp > 30 ? '#ffb300' : '#66bb6a'}>
          <strong>Temperature: {temp}°C</strong><br />
          <span style={{ marginTop: 4, display: 'block' }}>
            {temp > 40 ? '🔴 Extreme heat. Most crops stop growing above 40°C. Irrigate immediately. If possible, mist the canopy in the morning.' :
             temp > 35 ? '🟡 Heat stress zone. Grain filling slows or stops above 35°C. Irrigate in early morning (before 8 AM) to cool the soil.' :
             temp > 25 ? '🟢 Ideal temperature range for rice, maize, cotton, and most Kharif crops.' :
             temp > 15 ? '🟢 Cool and comfortable — perfect for Rabi crops like wheat, mustard, and chickpea.' :
             '🔵 Cold. Tropical crops like rice and cotton will slow or stall. Protect seedlings from frost if below 5°C.'}
          </span>
        </Block>
      )}

      {hum != null && (
        <Block color={hum > 85 ? '#ef5350' : hum > 70 ? '#ffb300' : '#66bb6a'}>
          <strong>Humidity: {hum}%</strong><br />
          <span style={{ marginTop: 4, display: 'block' }}>
            {hum > 85 ? '⚠️ Very high humidity. This is prime weather for fungal diseases — rice blast, late blight, powdery mildew. Inspect leaves for spots or lesions. Consider a preventive fungicide spray.' :
             hum > 70 ? 'Moderate-high humidity. Monitor closely if this persists for more than 3 days with warm nights.' :
             '✓ Low humidity. Low fungal risk. Ensure crop has enough water since dry air increases evaporation.'}
          </span>
        </Block>
      )}

      {wind != null && (
        <Block color={wind > 40 ? '#ef5350' : '#66bb6a'}>
          <strong>Wind: {wind} km/h</strong><br />
          <span style={{ marginTop: 4, display: 'block' }}>
            {wind > 40 ? '🔴 Strong wind. Risk of lodging (plants falling over), especially tall crops. Check your field for stem breakage.' :
             wind > 20 ? '🟡 Brisk wind. Drying conditions — soil moisture will decrease faster. Adjust irrigation schedule.' :
             '🟢 Light to moderate wind. Helps dry out the canopy after rain, reducing fungal disease risk.'}
          </span>
        </Block>
      )}

      {fcDays?.length > 0 && (
        <Block color="#42a5f5">
          <strong style={{ color: '#42a5f5' }}>7-day outlook: {fcRain.toFixed(0)} mm expected</strong><br />
          <span style={{ marginTop: 4, display: 'block' }}>
            {fcRain > 30 ? 'Sufficient rain forecast — you likely won\'t need to irrigate this week. Watch for waterlogging on flat or low-lying fields.' :
             fcRain > 10 ? 'Some rain expected but not enough to cover full crop water needs. Plan supplemental irrigation.' :
             'Less than 10 mm forecast — plan your irrigation schedule for the full week ahead.'}
          </span>
        </Block>
      )}

      <Tip>Pressure dropping below 1005 hPa usually signals incoming rain within 24 hours. Pressure above 1015 hPa = stable, dry weather ahead.</Tip>
    </>
  );
}

function buildExplainIndex(key, value, zone) {
  const v = value != null ? +value : null;
  const data = {
    NDWI: {
      summary: 'NDWI measures the water content inside your crop\'s leaves by comparing green and near-infrared light. Thirsty plants have lower NDWI.',
      current: v == null ? null : v > 0.3 ? 'Leaves are well-hydrated — no irrigation urgency.' : v > 0.1 ? 'Mild water stress. Keep irrigation consistent.' : v > 0 ? 'Water stress building. Irrigate within 1–2 days.' : 'Severe water stress. Irrigate immediately.',
      ranges: [
        { label: 'Above 0.3',  color: '#26a69a', note: 'Leaves well-hydrated — crop is not thirsty.' },
        { label: '0.1 – 0.3',  color: '#66bb6a', note: 'Mildly stressed — monitor and keep irrigation regular.' },
        { label: '0.0 – 0.1',  color: '#ffb300', note: 'Stress building — irrigate within 1–2 days.' },
        { label: 'Below 0.0',  color: '#ef5350', note: 'Severe water stress — irrigate immediately.' },
      ],
      tip: 'NDWI drops before your crop shows visible wilting. Catching it here prevents yield loss.',
    },
    NDRE: {
      summary: 'NDRE measures chlorophyll levels using the "red-edge" wavelength — a thin slice of light that plant cells change their reflection at. Chlorophyll = nitrogen. More nitrogen = greener, healthier, more productive leaves.',
      current: v == null ? null : v > 0.4 ? 'Excellent chlorophyll — leaves are dark green and well-nourished.' : v > 0.2 ? 'Adequate. Normal for early or late growth stages.' : 'Low chlorophyll — likely nitrogen deficiency. Leaves may be yellowing.',
      ranges: [
        { label: '0.4 – 0.7',  color: '#26a69a', note: 'Excellent — deep green, well-nourished.' },
        { label: '0.2 – 0.4',  color: '#66bb6a', note: 'Adequate — normal for early or late stages.' },
        { label: '0.1 – 0.2',  color: '#ffb300', note: 'Low — possible nitrogen deficiency, leaves yellowing.' },
        { label: 'Below 0.1',  color: '#ef5350', note: 'Severe deficiency — apply urea or foliar nitrogen now.' },
      ],
      tip: 'Use NDRE to decide if your crop needs a nitrogen top-dressing. Much more reliable than eyeballing leaf color.',
    },
    SAVI: {
      summary: 'SAVI is like NDVI but designed for fields where a lot of bare soil is still visible — common in early season or sparse stands. It mathematically removes the soil\'s color so you only measure the plants themselves.',
      current: v == null ? null : v > 0.5 ? 'Dense canopy — crop is well-established and covering the soil.' : v > 0.3 ? 'Moderate coverage — crop is growing but gaps exist.' : 'Sparse coverage — early season, poor emergence, or crop stress.',
      ranges: [
        { label: 'Above 0.5',  color: '#26a69a', note: 'Dense canopy — good crop establishment.' },
        { label: '0.3 – 0.5',  color: '#66bb6a', note: 'Moderate cover — crop growing well.' },
        { label: '0.1 – 0.3',  color: '#ffb300', note: 'Sparse — early season or poor emergence.' },
        { label: 'Below 0.1',  color: '#ef5350', note: 'Very thin stand — consider re-sowing gaps.' },
      ],
      tip: 'SAVI is most useful in the first 3–4 weeks after sowing when NDVI readings can be unreliable.',
    },
    BSI: {
      summary: 'BSI measures how much bare, exposed soil is visible from satellite. Low (or negative) BSI is good — it means your crop is covering the ground. High BSI means gaps in your crop stand or possible crop damage.',
      current: v == null ? null : v < 0 ? 'Great — crop canopy is fully covering the soil.' : v < 0.2 ? 'Some soil visible — normal in early season.' : 'Too much bare soil — poor stand, weed pressure, or crop damage.',
      ranges: [
        { label: 'Negative',    color: '#26a69a', note: 'Full crop cover — less evaporation, less weed pressure.' },
        { label: '0.0 – 0.2',   color: '#ffb300', note: 'Some bare soil — normal early season or wide spacing.' },
        { label: 'Above 0.2',   color: '#ef5350', note: 'Too much bare soil — gaps in stand, scout the field.' },
      ],
      tip: 'High BSI mid-season often indicates that pest or disease damage has killed patches of crop.',
    },
    NDMI: {
      summary: 'NDMI measures moisture stored across the whole plant — leaves, stems, and branches. It uses shortwave infrared light which is extremely sensitive to water. Think of it as a "whole-plant hydration" reading.',
      current: v == null ? null : v > 0.3 ? 'Plant is well-hydrated throughout.' : v > 0.1 ? 'Adequate moisture — monitor over coming days.' : 'Moisture stress building — check soil and irrigate.',
      ranges: [
        { label: 'Above 0.3', color: '#26a69a', note: 'Well-hydrated throughout the plant.' },
        { label: '0.1 – 0.3', color: '#66bb6a', note: 'Adequate — monitor over coming days.' },
        { label: '0.0 – 0.1', color: '#ffb300', note: 'Stress building — check soil moisture.' },
        { label: 'Below 0.0', color: '#ef5350', note: 'Severe moisture deficit — irrigate immediately.' },
      ],
      tip: 'Use NDMI + NDWI together: NDWI shows leaf water, NDMI shows whole-plant moisture. Both dropping = serious drought stress.',
    },
    EVI: {
      summary: 'EVI is an improved version of NDVI. It is better for dense, tall crops like sugarcane, paddy, and maize where NDVI tends to max out and stop giving useful readings.',
      current: v == null ? null : v > 0.5 ? 'Healthy, dense canopy.' : v > 0.3 ? 'Moderate development.' : 'Sparse or stressed crop.',
      ranges: [
        { label: '0.6 – 1.0', color: '#26a69a', note: 'Very dense, healthy canopy.' },
        { label: '0.4 – 0.6', color: '#66bb6a', note: 'Good crop development.' },
        { label: '0.2 – 0.4', color: '#ffb300', note: 'Moderate — some stress or early season.' },
        { label: 'Below 0.2', color: '#ef5350', note: 'Poor or stressed crop.' },
      ],
      tip: 'Use EVI as your primary health indicator once your crop reaches knee height or taller.',
    },
    NDVI: { summary: 'See the full NDVI explanation — click the NDVI KPI card at the top of the dashboard.', ranges: [], tip: '' },
  };
  const ex = data[key];
  if (!ex) return null;
  return (
    <>
      <p>{ex.summary}</p>

      {ex.current && (
        <Block color={zoneColor(zone)}>
          <strong style={{ color: zoneColor(zone) }}>Your reading ({fmt(v, 3)}) → {zone}:</strong>
          <div style={{ marginTop: 4 }}>{ex.current}</div>
        </Block>
      )}

      {ex.ranges.length > 0 && (
        <>
          <SectionHeading>Reading ranges for {key}:</SectionHeading>
          {ex.ranges.map(r => <RangeRow key={r.label} {...r} />)}
        </>
      )}

      {ex.tip && <Tip>{ex.tip}</Tip>}
    </>
  );
}

function buildExplainTrend(timeseries) {
  const n = timeseries?.length ?? 0;
  if (n < 2) return <p>Not enough data yet to show a trend. Come back after a few more satellite passes (every ~5 days).</p>;
  const first = timeseries[0]?.ndvi, last = timeseries[n - 1]?.ndvi;
  const trend = (first != null && last != null) ? (last - first) : null;
  let trendMsg = '';
  if (trend !== null) {
    if (trend > 0.1)     trendMsg = '📈 NDVI has been rising significantly over 90 days — your crop has grown and improved.';
    else if (trend > 0)  trendMsg = '📊 Slight upward trend — stable, positive growth.';
    else if (trend > -0.1) trendMsg = '📊 Roughly stable — normal for a crop approaching harvest.';
    else                 trendMsg = '📉 NDVI has fallen significantly — investigate for stress, disease, or harvest of some sections.';
  }
  return (
    <>
      <p>This chart shows how the satellite-measured health of your crop has changed over the last 90 days. Each data point is one satellite pass — Sentinel-2 flies over every 5 days. Only cloud-free images are included, so there may be gaps.</p>

      {trendMsg && <Block color="#66bb6a"><strong>{trendMsg}</strong></Block>}

      <SectionHeading>What each line means:</SectionHeading>
      <RangeRow label="NDVI (green)"    color="#66bb6a" note="Overall greenness and canopy health — the main line to watch." />
      <RangeRow label="EVI (cyan)"      color="#26c6da" note="Same as NDVI but more accurate for dense crops. Usually tracks NDVI closely." />
      <RangeRow label="NDWI (blue)"     color="#42a5f5" note="Water content in leaves. Dips before the crop looks dry — use it to plan irrigation ahead of time." />
      <RangeRow label="NDRE (purple)"   color="#ab47bc" note="Chlorophyll and nitrogen in leaves. Falling NDRE = time to fertilize." />

      <SectionHeading>How to spot problems:</SectionHeading>
      <RangeRow label="All lines falling together" color="#ef5350" note="Drought stress or general decline — check irrigation and soil." />
      <RangeRow label="NDWI falling, NDVI stable"  color="#ffb300" note="Water stress building before it affects canopy — irrigate now." />
      <RangeRow label="NDRE falling alone"          color="#ab47bc" note="Nitrogen deficiency — apply urea or top-dress fertilizer." />
      <RangeRow label="Sharp one-day dip"           color="#4a6650" note="Almost always a cloud contamination artifact — not real stress." />

      <Tip>A slow, steady decline over 2–3 weeks is the real concern. A sudden single dip followed by recovery is likely just a cloudy day on the satellite pass.</Tip>
    </>
  );
}

function buildExplainRainfall(rainfall, crop) {
  const total = rainfall?.total_mm;
  const needs = { rice: 5, wheat: 3.5, maize: 4, cotton: 4, sugarcane: 6 };
  const dailyNeed = needs[crop?.toLowerCase()] ?? 4;
  return (
    <>
      <p>This chart shows actual rainfall on your field over the past 30 days, from the <strong>CHIRPS</strong> satellite dataset (Climate Hazards Group, 5 km resolution). No rain gauge needed — it's measured from space.</p>

      {total != null && (
        <Block color={total >= dailyNeed * 30 ? '#66bb6a' : '#ffb300'}>
          <strong>Last 30 days total: {fmt(total, 1)} mm</strong><br />
          <span style={{ marginTop: 4, display: 'block' }}>
            Your {crop || 'crop'} needs roughly {dailyNeed} mm/day → {dailyNeed * 30} mm over 30 days.{' '}
            {total >= dailyNeed * 30
              ? `✓ Rainfall was sufficient — you likely needed little extra irrigation this month.`
              : `⚠️ Rainfall was ${fmt(dailyNeed * 30 - total, 0)} mm short of crop needs — supplemental irrigation was required.`}
          </span>
        </Block>
      )}

      <SectionHeading>How to read the chart:</SectionHeading>
      <RangeRow label="Many small bars"        color="#42a5f5" note="Consistent light rain — good for crops but watch for fungal disease." />
      <RangeRow label="A few very tall bars"   color="#ffb300" note="Heavy single events — risk of waterlogging. Check if water drained within 24 hours." />
      <RangeRow label="Long gap between bars"  color="#ef5350" note="Dry spell — irrigation needed to avoid crop stress." />

      <Tip>A single rainfall event over 50 mm in one day can waterlog low-lying fields and deprive roots of oxygen. After such an event, check if water drains from your field within a day.</Tip>
    </>
  );
}

function buildExplainSoilMoisture(sm) {
  const surf = sm?.surface_sm, sub = sm?.subsurface_sm;
  return (
    <>
      <p>These readings come from <strong>NASA's SMAP satellite</strong> (Soil Moisture Active Passive). It uses radar signals that penetrate into the soil and bounce back differently depending on how wet it is. No soil sensors required.</p>
      <p style={{ marginTop: 10 }}>The scale is <strong>0–100%</strong> representing volumetric water content — how much of the soil volume is actually water. 0% is completely dry sand; 100% is waterlogged.</p>

      <Block color="#42a5f5">
        <strong style={{ color: '#42a5f5' }}>Surface (0–5 cm): {surf != null ? Math.round(surf * 100) + '%' : '—'}</strong><br />
        <span style={{ marginTop: 4, display: 'block' }}>
          {surf == null ? 'No data.' :
           surf < 0.15 ? '🔴 Very dry — top soil layer is parched. Irrigate immediately.' :
           surf < 0.25 ? '🟡 Dry — getting low. Plan irrigation soon.' :
           surf < 0.45 ? '🟢 Good — surface moisture comfortable for most crops.' :
           surf < 0.6  ? '🟢 Moist — well watered. No immediate irrigation needed.' :
           '🔵 Saturated — too much water at surface. Check drainage.'}
        </span>
      </Block>

      <Block color="#0d8abc">
        <strong style={{ color: '#0d8abc' }}>Root Zone (5–50 cm): {sub != null ? Math.round(sub * 100) + '%' : '—'}</strong><br />
        <span style={{ marginTop: 4, display: 'block' }}>
          {sub == null ? 'No data.' :
           sub < 0.2  ? '🔴 Root zone is dry — deep roots cannot access water.' :
           sub < 0.35 ? '🟡 Getting low — irrigate before roots are stressed.' :
           sub < 0.5  ? '🟢 Ideal — good moisture for deep root penetration.' :
           '🔵 Saturated — risk of root disease (root rot, Pythium).'}
        </span>
      </Block>

      <SectionHeading>What the percentage means:</SectionHeading>
      <RangeRow label="0–20%"  color="#ef5350" note="Critically dry — crops wilting, yield loss occurring." />
      <RangeRow label="20–35%" color="#ffb300" note="Dry — stress building, irrigate soon." />
      <RangeRow label="35–55%" color="#66bb6a" note="Optimal — most crops grow best in this range." />
      <RangeRow label="55–70%" color="#42a5f5" note="Moist — good, but monitor for drainage." />
      <RangeRow label="70%+"   color="#ef5350" note="Saturated — roots deprived of oxygen, disease risk." />

      <Tip>SMAP has 10 km resolution — it measures a wider area than your field. Use it as a general guide and combine with direct soil observation (push a finger 5 cm into the soil — is it moist or dry?).</Tip>
    </>
  );
}

function buildExplainStage(stage, crop) {
  const current = stage?.current_stage;
  if (stage?.status !== 'active') {
    return (
      <>
        <p>The Crop Stage tracker tells you exactly where your crop is in its life cycle, what is happening biologically right now, and what you should be doing on the farm today.</p>
        <p style={{ marginTop: 10 }}>To activate it, go to <strong>My Fields</strong>, edit your field, and enter the date you sowed or transplanted. Croppy will then automatically calculate which stage you are in based on your crop type's known growth calendar.</p>
        <Block color="#ab47bc">
          <strong style={{ color: '#ab47bc' }}>Example for Rice (120 days):</strong><br />
          Germination (0–7d) → Seedling (7–20d) → Tillering (20–45d) → Panicle Initiation (45–65d) → Flowering (65–75d) → Grain Filling (75–100d) → Harvest (100–120d)
        </Block>
        <Tip>Knowing your growth stage is critical because different inputs (fertilizer, irrigation, pesticide) are only effective and appropriate at specific stages.</Tip>
      </>
    );
  }
  return (
    <>
      <p>Your <strong>{crop}</strong> is <strong>Day {stage.das}</strong> from sowing — out of approximately <strong>{stage.total_days} days</strong> total to harvest. It is currently in the <strong>{current?.name}</strong> stage.</p>
      <p style={{ marginTop: 10 }}>Each growth stage has specific biological events happening in the plant, and specific inputs that are effective at that time. Doing the right thing at the right stage is what separates good yields from great ones.</p>

      {current?.description && (
        <Block color="#ab47bc">
          <strong style={{ color: '#ab47bc' }}>What is happening in your crop RIGHT NOW:</strong>
          <div style={{ marginTop: 4 }}>{current.description}</div>
        </Block>
      )}

      {current?.critical && (
        <Block color="#ff7043">
          <strong style={{ color: '#ff7043' }}>⚠️ This is a CRITICAL stage.</strong> Any stress now — drought, heat, pest damage, or fertilizer shortage — directly reduces your final grain count and yield. Do not skip irrigation or fertilizer applications this week.
        </Block>
      )}

      {(current?.actions?.length ?? 0) > 0 && (
        <>
          <SectionHeading>What to do right now:</SectionHeading>
          {current.actions.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <CheckCircle size={15} color="#66bb6a" style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{a}</span>
            </div>
          ))}
        </>
      )}

      {stage.next_stage && (
        <Block color="#42a5f5">
          <strong style={{ color: '#42a5f5' }}>Coming up: {stage.next_stage.name}</strong> (in {stage.next_stage.starts_in_days} days)<br />
          <span style={{ marginTop: 4, display: 'block', color: '#4a6650', fontSize: '0.85rem' }}>Start preparing inputs and equipment needed for the next stage now.</span>
        </Block>
      )}

      <Tip>The progress bar shows how far through this specific stage you are. When it reaches 100%, the next stage begins.</Tip>
    </>
  );
}

function buildExplainMarket(prices, crop) {
  const top = prices?.[0];
  return (
    <>
      <p>These are live prices from agricultural markets (<strong>mandis</strong>) across India, sourced from Agmarknet. Data is updated daily. All prices are in <strong>₹ per quintal</strong> (1 quintal = 100 kg).</p>

      <SectionHeading>Understanding the three price types:</SectionHeading>
      <RangeRow label="Modal price" color="#66bb6a" note="The price at which the most trades happened today. This is the 'going rate' — use it to decide when and where to sell." />
      <RangeRow label="Min price"   color="#42a5f5" note="The lowest price any seller accepted today. Avoid selling below this — only accept if you urgently need cash." />
      <RangeRow label="Max price"   color="#ffb300" note="Highest price achieved — usually for premium quality or favoured buyers. Grade your produce to access higher prices." />

      {top?.modal_price && (
        <Block color="#66bb6a">
          <strong style={{ color: '#66bb6a' }}>Today at {top.mandi}: ₹{top.modal_price.toLocaleString()}/qt</strong><br />
          <div style={{ marginTop: 6, color: '#4a6650', fontSize: '0.85rem' }}>
            If your {crop} field produces 4 tonnes (40 quintals): estimated income → <strong style={{ color: '#66bb6a' }}>₹{(top.modal_price * 40).toLocaleString()}</strong><br />
            If it produces 6 tonnes (60 quintals): → <strong style={{ color: '#66bb6a' }}>₹{(top.modal_price * 60).toLocaleString()}</strong>
          </div>
        </Block>
      )}

      <SectionHeading>How to use this data:</SectionHeading>
      <p>Prices vary between mandis by 10–20%. Check multiple mandis listed below and factor in transportation cost. If today's prices are low, consider storing for 2–4 weeks if you have storage facilities — prices often rise after the main harvest rush passes.</p>

      <Tip>1 quintal = 100 kg. 1 tonne = 10 quintals. If your field is 2 hectares with rice yield of 5 t/ha, you have 10 tonnes = 100 quintals to sell.</Tip>
    </>
  );
}

function buildExplainAlerts() {
  return (
    <>
      <p>Croppy automatically scans your satellite data every time you refresh and generates alerts when it detects something that needs your attention. You don't need to check every number yourself — the system flags what matters.</p>

      <SectionHeading>Severity levels:</SectionHeading>
      <RangeRow label="High (red)"    color="#ef5350" note="Needs immediate attention — significant crop risk within 1–3 days." />
      <RangeRow label="Medium (amber)" color="#ffb300" note="Monitor closely — take action within the week." />
      <RangeRow label="Low (green)"   color="#66bb6a" note="Informational — good to know but no immediate action required." />

      <SectionHeading>Common alert types and what they mean:</SectionHeading>
      <Block color="#42a5f5">
        <strong>NDVI drop</strong> — The crop's greenness score fell significantly since the last satellite reading. Check for water stress, pest damage, or disease in the field.
      </Block>
      <Block color="#ef5350">
        <strong>Water stress</strong> — NDWI shows your plant's leaves are dehydrated. Irrigate as soon as possible.
      </Block>
      <Block color="#ff7043">
        <strong>Heat stress</strong> — Temperature crossed the safe threshold for your crop. Irrigate early morning to cool the soil.
      </Block>
      <Block color="#ab47bc">
        <strong>Fungal risk</strong> — High humidity combined with warm temperatures creates ideal conditions for fungal diseases. Scout the field for spots, lesions, or mold.
      </Block>
      <Block color="#42a5f5">
        <strong>Rainfall excess</strong> — Unusually heavy rainfall detected. Check if your field is draining properly.
      </Block>

      <Tip>Press ACK (Acknowledge) once you have seen an alert and taken action. This removes it from the active list so you can focus on new alerts.</Tip>
    </>
  );
}

function buildExplainSpectralMap(spectralTab, selectedIdx) {
  return (
    <>
      <p>The map shows your field from space using <strong>Sentinel-2 satellite imagery</strong> (10 metre resolution, updated every 5 days). Each tab shows a different way of "seeing" your field — different wavelengths of light reveal different things about your crop.</p>

      <SectionHeading>What each tab shows:</SectionHeading>
      <RangeRow label="NDVI"       color="#66bb6a" note="Overall greenness. Green = healthy crop. Red = stressed or bare." />
      <RangeRow label="EVI"        color="#26c6da" note="Same as NDVI but more accurate for dense crops. Teal = healthy." />
      <RangeRow label="NDWI"       color="#42a5f5" note="Water content in leaves. Blue = well-watered. Yellow = dry." />
      <RangeRow label="NDRE"       color="#ab47bc" note="Chlorophyll and nitrogen. Purple = well-fed. Orange = deficient." />
      <RangeRow label="SAVI"       color="#8bc34a" note="Crop coverage, corrected for soil background. Good in early season." />
      <RangeRow label="BSI"        color="#ff8a65" note="Bare soil visibility. Blue = good crop cover. Orange = gaps/bare patches." />
      <RangeRow label="NDMI"       color="#4dd0e1" note="Whole-plant moisture. Cyan = hydrated. Red = dry." />
      <RangeRow label="True Color" color="#4a6650" note="Natural color — what your field looks like in a normal photo from space." />

      <SectionHeading>How to use the map:</SectionHeading>
      <p>The polygon outline and fill color shows your field's health zone for the selected index. Switch between tabs to understand different aspects of crop health. If one tab shows yellow/red but others are green, that helps pinpoint the specific issue (e.g., NDRE falling but NDVI fine = nitrogen issue, not water).</p>

      {spectralTab !== 'True Color' && selectedIdx && (
        <Block color={zoneColor(selectedIdx.health_zone)}>
          <strong style={{ color: zoneColor(selectedIdx.health_zone) }}>Currently viewing: {spectralTab} = {fmt(selectedIdx.value, 3)} → {selectedIdx.health_zone}</strong>
        </Block>
      )}

      <Tip>Click any index card below the map to instantly switch the map to show that index.</Tip>
    </>
  );
}

function buildExplainAdvisory() {
  return (
    <>
      <p>Advisories are automatically generated recommendations based on your satellite data, current weather, and crop growth stage. They translate complex index readings into simple, actionable instructions so you know <strong>what to do and when</strong> — without needing to interpret numbers yourself.</p>

      <SectionHeading>How advisories are generated:</SectionHeading>
      <p>The advisory engine reads all your indices, weather forecast, and crop stage every time you refresh. It cross-references rules built from agronomic research (e.g., if NDWI &lt; 0.1 and temperature &gt; 32°C during flowering → issue irrigation advisory).</p>

      <SectionHeading>Priority levels:</SectionHeading>
      <RangeRow label="Critical (red)"    color="#ef5350" note="Take action today — high risk of yield loss without intervention." />
      <RangeRow label="Warning (amber)"   color="#ffb300" note="Something to watch — act within the week." />
      <RangeRow label="Info (green/grey)" color="#66bb6a" note="General guidance for your crop stage — good-practice reminders." />

      <Tip>Visit the full Advisory page for fertilizer schedules, pest management calendars, and detailed stage-by-stage growing guides for your specific crop.</Tip>
    </>
  );
}

// ── Shared: Explain button ────────────────────────────────────────────────────
function ExplainBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
        background: 'rgba(67,160,71,0.08)', border: '1px solid rgba(67,160,71,0.25)',
        color: '#2e7d32', fontSize: '0.73rem', fontWeight: 600,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      <HelpCircle size={12} /> Explain
    </button>
  );
}

// ── Soil Gauge ────────────────────────────────────────────────────────────────
function SoilGauge({ value, label, color = '#42a5f5' }) {
  const pct = Math.max(0, Math.min(1, value ?? 0));
  const r = 38, cx = 50, cy = 52;
  const arc = (deg) => {
    const rad = (deg - 180) * Math.PI / 180;
    return `${cx + r * Math.cos(rad)} ${cy + r * Math.sin(rad)}`;
  };
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={110} height={66} viewBox="0 0 100 66">
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(180)}`} fill="none" stroke="rgba(67,160,71,0.08)" strokeWidth={8} strokeLinecap="round" />
        <path d={`M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(pct * 180)}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
        <text x="50" y="54" textAnchor="middle" fill={color} fontSize="13" fontWeight="700">{Math.round(pct * 100)}%</text>
      </svg>
      <div style={{ fontSize: '0.74rem', color: '#4a6650', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AdvisoryCard({ card }) {
  const S = {
    danger:  { border: '#ef5350', bg: 'rgba(239,83,80,0.08)',   color: '#ef5350' },
    warning: { border: '#ffb300', bg: 'rgba(255,179,0,0.08)',   color: '#ffb300' },
    success: { border: '#66bb6a', bg: 'rgba(102,187,106,0.08)', color: '#66bb6a' },
    info:    { border: 'rgba(67,160,71,0.1)', bg: 'transparent', color: '#4a6650' },
  };
  const s = S[card.severity] || S.info;
  return (
    <div style={{ border: `1px solid ${s.border}`, background: s.bg, borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
      <div style={{ fontWeight: 600, fontSize: '0.86rem', color: s.color, marginBottom: 5 }}>{card.title}</div>
      <div style={{ fontSize: '0.82rem', color: '#2e7d32', lineHeight: 1.6 }}>{card.message}</div>
    </div>
  );
}

// ── Card header helper ────────────────────────────────────────────────────────
function CardHeader({ icon, title, badge, onExplain, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>{icon} {title}</div>
        {badge}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {children}
        {onExplain && <ExplainBtn onClick={e => { e.stopPropagation(); onExplain(); }} />}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [fields,       setFields]       = useState([]);
  const [activeField,  setActiveField]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [spectralTab,  setSpectralTab]  = useState('NDVI');
  const [modal,        setModal]        = useState(null); // { title, content }

  const [indices,      setIndices]      = useState(null);
  const [weather,      setWeather]      = useState(null);
  const [forecast,     setForecast]     = useState([]);
  const [timeseries,   setTimeseries]   = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [alertSummary, setAlertSummary] = useState(null);
  const [advisory,     setAdvisory]     = useState(null);
  const [rainfall,     setRainfall]     = useState(null);
  const [soilMoisture, setSoilMoisture] = useState(null);
  const [marketPrices, setMarketPrices] = useState([]);
  const [thumbnail,    setThumbnail]    = useState(null);
  const [indexImage,   setIndexImage]   = useState(null);   // { url, index }
  const [indexImgLoading, setIndexImgLoading] = useState(false);

  useEffect(() => {
    listFields()
      .then(r => {
        const list = r.data || [];
        setFields(list);
        if (list.length) setActiveField(list[0]);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchData = useCallback((field) => {
    if (!field) return;
    const end     = new Date().toISOString().slice(0, 10);
    const start90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const start30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { lat, lon, crop_type, sowing_date, polygon } = field;

    Promise.allSettled([
      getIndices(lat, lon, start90, end, field.id),
      getCurrentWeather(lat, lon),
      getForecast(lat, lon),
      getTimeseries(lat, lon, start90, end),
      getAlerts(true),
      getAlertSummary(),
      getAdvisory({ crop_type, lat, lon, sowing_date: sowing_date || null }),
      getRainfall(lat, lon, start30, end, polygon),
      getSoilMoisture(lat, lon, start30, end),
      getMarketPrices(crop_type),
      getThumbnail(lat, lon, start90, end, polygon),
    ]).then(([idxR, wxR, fcR, tsR, alR, alSumR, advR, rainR, smR, mktR, thumbR]) => {
      if (idxR.status   === 'fulfilled') setIndices(idxR.value.data);
      if (wxR.status    === 'fulfilled') setWeather(wxR.value.data);
      if (fcR.status    === 'fulfilled') setForecast(fcR.value.data?.daily || fcR.value.data || []);
      if (tsR.status    === 'fulfilled') setTimeseries(tsR.value.data?.points || []);
      if (alR.status    === 'fulfilled') setAlerts(alR.value.data || []);
      if (alSumR.status === 'fulfilled') setAlertSummary(alSumR.value.data);
      if (advR.status   === 'fulfilled') setAdvisory(advR.value.data);
      if (rainR.status  === 'fulfilled') setRainfall(rainR.value.data);
      if (smR.status    === 'fulfilled') setSoilMoisture(smR.value.data);
      if (mktR.status   === 'fulfilled') setMarketPrices(mktR.value.data || []);
      if (thumbR.status === 'fulfilled') setThumbnail(thumbR.value.data);
      setLastUpdated(new Date());
      setLoading(false);
      setRefreshing(false);
    });
  }, []);

  useEffect(() => {
    if (!activeField) return;
    setLoading(true);
    fetchData(activeField);
  }, [activeField, fetchData]);

  // Fetch spectral index thumbnail whenever tab or field changes
  useEffect(() => {
    if (!activeField) return;
    if (spectralTab === 'True Color') { setIndexImage(null); return; }
    const end     = new Date().toISOString().slice(0, 10);
    const start90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const { lat, lon, polygon } = activeField;
    setIndexImgLoading(true);
    setIndexImage(null);
    getIndexThumbnail(lat, lon, start90, end, spectralTab, polygon)
      .then(r => setIndexImage(r.data))
      .catch(() => setIndexImage(null))
      .finally(() => setIndexImgLoading(false));
  }, [spectralTab, activeField]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const centroid   = activeField
    ? (polygonCentroid(activeField.polygon) || { lat: activeField.lat, lon: activeField.lon })
    : null;
  const bounds     = activeField?.polygon?.length >= 3 ? polygonBounds(activeField.polygon) : null;
  const idxMap     = indices?.indices || {};
  const indexList  = Object.entries(idxMap).map(([key, val]) => ({ key, ...val }));
  const selectedIdx= idxMap[spectralTab];
  const stage      = advisory?.growth_stage;
  const cards      = advisory?.advisory_cards || [];
  const topMarket  = marketPrices[0];
  const activeAlertCount = alertSummary?.active ?? alerts.filter(a => !a.acknowledged).length;
  const fcDays     = Array.isArray(forecast) ? forecast.slice(0, 7) : [];
  const forecastRain = fcDays.reduce((s, d) => s + (d.rain_mm ?? d.rain?.['3h'] ?? 0), 0);
  const rainDaily  = (rainfall?.daily || []).map(d => ({ date: d.date?.slice(5), mm: +(d.precipitation_mm ?? 0).toFixed(1) }));

  const openModal = (title, content) => setModal({ title, content });

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (!loading && fields.length === 0) {
    return (
      <div>
        <div className="page-header"><h1>{t("dashboard")}</h1></div>
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <Sprout size={52} color="var(--green-400)" style={{ marginBottom: 18 }} />
          <h3 style={{ marginBottom: 10 }}>Register your first field to unlock insights</h3>
          <p className="text-muted" style={{ marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>
            Draw your field boundary to access satellite NDVI maps, weather forecasts, pest risk, and automated advisories.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/onboard')}>Get Started</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ExplainModal data={modal} onClose={() => setModal(null)} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>{t("dashboard")}</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {activeField ? (
              <>
                <MapPin size={13} style={{ display: 'inline', flexShrink: 0 }} />
                <span>{activeField.name} · {activeField.crop_type}{activeField.area_ha ? ` · ${activeField.area_ha} ha` : ''}{activeField.state ? ` · ${activeField.state}` : ''}</span>
                {lastUpdated && <span style={{ fontSize: '0.73rem', color: '#4a6650' }}>— updated {lastUpdated.toLocaleTimeString()}</span>}
              </>
            ) : 'No fields registered'}
          </p>
        </div>
        <div className="flex gap-10" style={{ alignItems: 'center' }}>
          {fields.length > 1 && (
            <select className="input" style={{ width: 'auto', minWidth: 210 }} value={activeField?.id || ''}
              onChange={e => { setLoading(true); setActiveField(fields.find(f => f.id === e.target.value)); }}>
              {fields.map(f => <option key={f.id} value={f.id}>{f.name} ({f.crop_type})</option>)}
            </select>
          )}
          <button className="btn btn-secondary" style={{ padding: '7px 14px' }} disabled={refreshing || loading}
            onClick={() => { setRefreshing(true); fetchData(activeField); }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay" style={{ height: 320 }}>
          <div className="spinner" /><p>Fetching satellite data…</p>
        </div>
      )}

      {!loading && activeField && (
        <>
          {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
          <div style={{ fontSize: '0.72rem', color: '#4a6650', marginBottom: 12 }}>
            Click any metric card for a plain-language explanation of what the number means for your crop.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 32 }}>
            {[
              {
                icon: <Activity size={20} color={zoneColor(idxMap.NDVI?.health_zone)} />,
                label: 'NDVI Score', value: idxMap.NDVI?.value != null ? fmt(idxMap.NDVI.value, 3) : '—',
                sub: idxMap.NDVI?.health_zone || '', color: zoneColor(idxMap.NDVI?.health_zone),
                title: 'NDVI — Crop Greenness Score', content: buildExplainNdvi(idxMap.NDVI?.value, idxMap.NDVI?.health_zone, activeField.crop_type),
              },
              {
                icon: <Sprout size={20} color={zoneColor(idxMap.EVI?.health_zone)} />,
                label: 'Crop Health', value: idxMap.EVI?.health_zone || '—',
                sub: `EVI ${fmt(idxMap.EVI?.value, 3)}`, color: zoneColor(idxMap.EVI?.health_zone),
                title: 'Crop Health (EVI)', content: buildExplainEvi(idxMap.EVI?.value, idxMap.EVI?.health_zone),
              },
              {
                icon: <Bell size={20} color={activeAlertCount > 0 ? '#ef5350' : '#66bb6a'} />,
                label: 'Active Alerts', value: activeAlertCount ?? '—',
                sub: alertSummary ? `${alertSummary.high || 0} high severity` : '',
                color: activeAlertCount > 0 ? '#ef5350' : '#66bb6a',
                title: 'Active Alerts — What they mean', content: buildExplainAlerts(),
              },
              {
                icon: <CloudRain size={20} color="#42a5f5" />,
                label: '7-day Rain', value: forecastRain > 0 ? `${forecastRain.toFixed(0)} mm` : (rainfall?.total_mm != null ? `${fmt(rainfall.total_mm, 0)} mm` : '—'),
                sub: 'forecast total', color: '#42a5f5',
                title: 'Rainfall — What the numbers mean', content: buildExplainRainfall(rainfall, activeField.crop_type),
              },
              {
                icon: <Thermometer size={20} color="#ff7043" />,
                label: 'Temperature', value: weather?.temp_c != null ? `${weather.temp_c}°C` : '—',
                sub: weather?.feels_like_c ? `Feels ${weather.feels_like_c}°C` : (weather?.description || ''),
                color: '#ff7043',
                title: 'Weather — What it means for your crop', content: buildExplainWeather(weather, fcDays),
              },
              {
                icon: <Calendar size={20} color="#ab47bc" />,
                label: 'Crop Stage', value: stage?.status === 'active' ? `Day ${stage.das}` : '—',
                sub: stage?.current_stage?.name || 'No sowing date', color: '#ab47bc',
                title: 'Crop Stage Tracker', content: buildExplainStage(stage, activeField.crop_type),
              },
            ].map(({ icon, label, value, sub, color, title, content }) => (
              <div key={label} className="card" style={{ padding: '18px 18px', cursor: 'pointer', transition: 'border 0.2s' }}
                onClick={() => openModal(title, content)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', color: '#4a6650', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                    {sub && <div style={{ fontSize: '0.72rem', color: '#4a6650', marginTop: 3 }}>{sub}</div>}
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'rgba(102,187,106,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HelpCircle size={10} /> tap to explain
                </div>
              </div>
            ))}
          </div>

          {/* Critical banners */}
          {cards.filter(c => c.severity === 'danger').map((c, i) => <AdvisoryCard key={i} card={c} />)}

          {/* ── Row 1: Spectral Map + Weather ────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 24, marginBottom: 32 }}>

            {/* Spectral Map */}
            <div className="card">
              <CardHeader
                icon={<Layers size={18} />} title="Spectral Map"
                badge={<span className="badge badge-green">Sentinel-2</span>}
                onExplain={() => openModal('Spectral Map — How to Read It', buildExplainSpectralMap(spectralTab, selectedIdx))}
              >
              </CardHeader>
              {/* Tab selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {INDEX_TABS.map(tab => {
                  const c = INDEX_META[tab]?.color || '#66bb6a';
                  const active = spectralTab === tab;
                  return (
                    <button key={tab} onClick={() => setSpectralTab(tab)} style={{
                      padding: '5px 12px', borderRadius: 7, fontSize: '0.76rem', fontWeight: 600,
                      border: active ? `1px solid ${c}` : '1px solid rgba(67,160,71,0.1)',
                      background: active ? `${c}22` : 'transparent', color: active ? c : '#4a6650',
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {tab}
                    </button>
                  );
                })}
              </div>
              {/* Index value row */}
              {spectralTab !== 'True Color' && selectedIdx && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, fontSize: '0.82rem', color: '#4a6650' }}>
                  <span style={{ fontWeight: 700, color: INDEX_META[spectralTab]?.color || '#66bb6a', fontSize: '1.05rem' }}>{fmt(selectedIdx.value, 3)}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.73rem', fontWeight: 600, background: `${zoneColor(selectedIdx.health_zone)}22`, color: zoneColor(selectedIdx.health_zone) }}>{selectedIdx.health_zone}</span>
                  <span>{INDEX_META[spectralTab]?.label}</span>
                </div>
              )}
              {/* Map — uses .map-container class for correct Leaflet CSS */}
              <div style={{ position: 'relative' }}>
                <div className="map-container" style={{ height: 420 }}>
                  <MapContainer center={[centroid.lat, centroid.lon]} zoom={14} scrollWheelZoom key={`${centroid.lat},${centroid.lon}`}>
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri World Imagery" />
                    {/* True Color overlay */}
                    {spectralTab === 'True Color' && thumbnail?.url && bounds && (
                      <ImageOverlay url={thumbnail.url} bounds={bounds} opacity={0.9} />
                    )}
                    {/* Spectral index overlay */}
                    {spectralTab !== 'True Color' && indexImage?.url && bounds && (
                      <ImageOverlay url={indexImage.url} bounds={bounds} opacity={0.85} />
                    )}
                    {/* Field boundary — thin white outline on top of index map */}
                    {activeField.polygon?.length >= 3 ? (
                      <Polygon positions={activeField.polygon}
                        pathOptions={{
                          color: '#fff',
                          fillColor: 'transparent',
                          fillOpacity: 0,
                          weight: 2,
                          dashArray: spectralTab !== 'True Color' ? '6 3' : null,
                        }}>
                        <Popup>
                          <strong>{activeField.name}</strong><br />{activeField.crop_type}<br />
                          {spectralTab !== 'True Color' && selectedIdx
                            ? <>{spectralTab}: {fmt(selectedIdx.value, 3)} — {selectedIdx.health_zone}</>
                            : 'True Color (Sentinel-2)'}
                        </Popup>
                      </Polygon>
                    ) : (
                      <Marker position={[centroid.lat, centroid.lon]}><Popup><strong>{activeField.name}</strong></Popup></Marker>
                    )}
                  </MapContainer>
                </div>
                {/* Loading spinner over map while fetching index image */}
                {indexImgLoading && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 1000,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(10,15,13,0.65)', borderRadius: 'var(--radius-lg)',
                    gap: 10,
                  }}>
                    <div className="spinner" />
                    <span style={{ color: '#4a6650', fontSize: '0.82rem' }}>
                      Loading {spectralTab} from Sentinel-2…
                    </span>
                  </div>
                )}
              </div>

              {/* Color scale legend */}
              {spectralTab !== 'True Color' && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.72rem', color: '#4a6650' }}>
                  {(() => {
                    const palettes = {
                      NDVI: { stops: ['#d73027','#fc8d59','#fee08b','#d9ef8b','#91cf60','#1a9850'], min: '-0.1', max: '0.85', lo: 'Bare/Stressed', hi: 'Dense Vegetation' },
                      EVI:  { stops: ['#d73027','#fc8d59','#fee08b','#d9ef8b','#91cf60','#1a9850'], min: '-0.1', max: '0.7',  lo: 'Bare/Stressed', hi: 'Dense Vegetation' },
                      NDWI: { stops: ['#8b4513','#d2b48c','#f5f5dc','#b0e0e6','#4fc3f7','#0277bd'], min: '-0.5', max: '0.5',  lo: 'Dry',           hi: 'Water/Wet'       },
                      NDRE: { stops: ['#d73027','#fc8d59','#fee08b','#a8ddb5','#43a047','#1b5e20'], min: '-0.1', max: '0.55', lo: 'Low Chlorophyll',hi: 'High Chlorophyll' },
                      SAVI: { stops: ['#d73027','#fc8d59','#fee08b','#d9ef8b','#91cf60','#1a9850'], min: '-0.1', max: '0.7',  lo: 'Bare Soil',     hi: 'Dense Vegetation'},
                      BSI:  { stops: ['#1a9850','#91cf60','#fee08b','#fc8d59','#d73027','#7f0000'], min: '-0.5', max: '0.5',  lo: 'Vegetated',     hi: 'Bare Soil'       },
                      NDMI: { stops: ['#7f0000','#d73027','#fc8d59','#fee08b','#4fc3f7','#0277bd'], min: '-0.5', max: '0.5',  lo: 'Dry',           hi: 'High Moisture'   },
                    };
                    const p = palettes[spectralTab] || palettes.NDVI;
                    return (
                      <>
                        <span style={{ whiteSpace: 'nowrap' }}>{p.lo} ({p.min})</span>
                        <div style={{
                          flex: 1, height: 10, borderRadius: 5,
                          background: `linear-gradient(to right, ${p.stops.join(',')})`,
                          border: '1px solid rgba(67,160,71,0.08)',
                        }} />
                        <span style={{ whiteSpace: 'nowrap' }}>({p.max}) {p.hi}</span>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Weather Panel */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                icon={<Thermometer size={18} />} title="Weather"
                onExplain={() => openModal('Weather — What it means for your crop', buildExplainWeather(weather, fcDays))}
              />
              {weather ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: '3rem', lineHeight: 1 }}>{WX_ICONS[weather.weather?.[0]?.main] || '🌤️'}</div>
                    <div>
                      <div style={{ fontSize: '2.4rem', fontWeight: 700, lineHeight: 1 }}>{weather.temp_c}°C</div>
                      <div style={{ fontSize: '0.83rem', color: '#4a6650', marginTop: 4 }}>{weather.description || weather.weather?.[0]?.description || ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 20 }}>
                    {[
                      { icon: <Thermometer size={14} color="#ff7043" />, label: 'Feels like',  val: `${weather.feels_like_c ?? '—'}°C` },
                      { icon: <Droplets    size={14} color="#42a5f5" />, label: 'Humidity',    val: `${weather.humidity_pct ?? '—'}%` },
                      { icon: <Wind        size={14} color="#4a6650" />, label: 'Wind',        val: `${weather.wind_kph ?? '—'} km/h` },
                      { icon: <CloudRain   size={14} color="#42a5f5" />, label: 'Rain today',  val: `${weather.rainfall_mm ?? 0} mm` },
                      { icon: <Activity    size={14} color="#ab47bc" />, label: 'Pressure',    val: `${weather.pressure_hpa ?? '—'} hPa` },
                      { icon: <Eye         size={14} color="#66bb6a" />, label: 'Visibility',  val: weather.visibility_km != null ? `${weather.visibility_km} km` : '—' },
                    ].map(({ icon, label, val }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {icon}
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#4a6650' }}>{label}</div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {fcDays.length > 0 && (
                    <>
                      <div style={{ fontSize: '0.72rem', color: '#4a6650', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>7-Day Forecast</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {fcDays.map((d, i) => {
                          const dt   = d.dt ? new Date(d.dt * 1000) : new Date(Date.now() + i * 86400000);
                          const day  = i === 0 ? 'Today' : dt.toLocaleDateString('en', { weekday: 'short' });
                          const icon = WX_ICONS[d.weather?.[0]?.main] || WX_ICONS[d.main] || '🌤️';
                          const hi   = d.temp?.max ?? d.temp_max_c;
                          const lo   = d.temp?.min ?? d.temp_min_c;
                          const rain = d.rain ?? d.rain_mm ?? 0;
                          return (
                            <div key={i} style={{ textAlign: 'center', padding: '7px 3px', borderRadius: 8, background: i === 0 ? 'rgba(102,187,106,0.1)' : 'rgba(67,160,71,0.03)' }}>
                              <div style={{ fontSize: '0.63rem', color: '#4a6650', marginBottom: 2 }}>{day}</div>
                              <div style={{ fontSize: '1.1rem' }}>{icon}</div>
                              <div style={{ fontSize: '0.73rem', fontWeight: 700, marginTop: 2 }}>{hi != null ? Math.round(hi) : '—'}°</div>
                              <div style={{ fontSize: '0.63rem', color: '#4a6650' }}>{lo != null ? Math.round(lo) : '—'}°</div>
                              {rain > 0 && <div style={{ fontSize: '0.6rem', color: '#42a5f5', marginTop: 1 }}>{(+rain).toFixed(0)}mm</div>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ) : <p className="text-muted" style={{ fontSize: '0.85rem' }}>Weather data unavailable.</p>}
            </div>
          </div>

          {/* ── Index Cards ───────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '0.73rem', color: '#4a6650', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Spectral Indices {indices?.image_count != null ? `— ${indices.image_count} Sentinel-2 images composited` : ''}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#4a6650' }}>Click a card to show it on the map · Click "?" for explanation</div>
            </div>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
              {indexList.length > 0 ? indexList.map(idx => {
                const meta   = INDEX_META[idx.key];
                const active = spectralTab === idx.key;
                return (
                  <div key={idx.key} style={{ flexShrink: 0, width: 165, borderRadius: 14, border: `1px solid ${active ? (meta?.color || '#66bb6a') : 'rgba(67,160,71,0.08)'}`, background: active ? `${meta?.color || '#66bb6a'}12` : 'var(--card-bg)', transition: 'all 0.15s', overflow: 'hidden' }}>
                    <div onClick={() => setSpectralTab(idx.key)} style={{ padding: '14px 16px', cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4a6650', letterSpacing: '0.07em', marginBottom: 6 }}>{idx.key}</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: zoneColor(idx.health_zone), lineHeight: 1.1, marginBottom: 6 }}>
                        {idx.value != null ? idx.value.toFixed(3) : '—'}
                      </div>
                      <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.69rem', fontWeight: 600, background: `${zoneColor(idx.health_zone)}22`, color: zoneColor(idx.health_zone), marginBottom: 6 }}>
                        {idx.health_zone || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#4a6650', lineHeight: 1.5 }}>
                        {(idx.description || meta?.label || '').slice(0, 50)}
                      </div>
                    </div>
                    <button
                      onClick={() => openModal(`${idx.key} — ${meta?.label || 'Index'}`, buildExplainIndex(idx.key, idx.value, idx.health_zone))}
                      style={{ width: '100%', padding: '8px', fontSize: '0.72rem', fontWeight: 600, color: meta?.color || '#66bb6a', background: `${meta?.color || '#66bb6a'}0a`, border: 'none', borderTop: `1px solid ${meta?.color || '#66bb6a'}25`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <HelpCircle size={11} /> What does this mean?
                    </button>
                  </div>
                );
              }) : <p className="text-muted" style={{ fontSize: '0.84rem', padding: '8px 0' }}>Spectral data loading via GEE…</p>}
            </div>
          </div>

          {/* ── Row 2: Trend + Rainfall ───────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div className="card">
              <CardHeader icon={<TrendingUp size={18} />} title="Vegetation Trend (90 days)"
                onExplain={() => openModal('Vegetation Trend — How to Read It', buildExplainTrend(timeseries))} />
              <div style={{ height: 250 }}>
                {timeseries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeseries} margin={{ top: 4, right: 10, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(67,160,71,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
                      <YAxis domain={[-0.2, 1]} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(67,160,71,0.2)', borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="ndvi" name="NDVI" stroke="#66bb6a" strokeWidth={2}   dot={false} />
                      <Line type="monotone" dataKey="evi"  name="EVI"  stroke="#26c6da" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="ndwi" name="NDWI" stroke="#42a5f5" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="ndre" name="NDRE" stroke="#ab47bc" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="loading-overlay"><p className="text-muted" style={{ fontSize: '0.84rem' }}>No time-series data available</p></div>
                )}
              </div>
            </div>

            <div className="card">
              <CardHeader icon={<CloudRain size={18} />} title="Rainfall — CHIRPS (30 days)"
                badge={rainfall?.total_mm != null ? <span style={{ fontSize: '0.8rem', color: '#42a5f5' }}>Total {fmt(rainfall.total_mm, 1)} mm</span> : null}
                onExplain={() => openModal('Rainfall Chart — What it means', buildExplainRainfall(rainfall, activeField.crop_type))} />
              <div style={{ height: 250 }}>
                {rainDaily.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rainDaily} margin={{ top: 4, right: 10, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(67,160,71,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(66,165,245,0.2)', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v} mm`, 'Rainfall']} />
                      <Bar dataKey="mm" name="Rainfall (mm)" fill="#42a5f5" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="loading-overlay"><p className="text-muted" style={{ fontSize: '0.84rem' }}>Rainfall data unavailable</p></div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 3: Crop Stage + Soil Moisture + Market ───────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 32 }}>

            <div className="card">
              <CardHeader icon={<Sprout size={18} />} title="Crop Stage"
                onExplain={() => openModal('Crop Stage Tracker — What it means', buildExplainStage(stage, activeField.crop_type))} />
              {stage?.status === 'active' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{stage.current_stage?.name}</span>
                    <span style={{ fontSize: '0.77rem', color: '#4a6650' }}>Day {stage.das}/{stage.total_days}</span>
                  </div>
                  <div style={{ background: 'rgba(67,160,71,0.07)', borderRadius: 6, height: 7, marginBottom: 16 }}>
                    <div style={{ width: `${stage.current_stage?.progress_pct ?? 0}%`, background: stage.current_stage?.critical ? '#ff7043' : '#66bb6a', borderRadius: 6, height: 7, transition: 'width 0.8s ease' }} />
                  </div>
                  {stage.current_stage?.description && (
                    <p style={{ fontSize: '0.81rem', color: '#2e7d32', marginBottom: 14, lineHeight: 1.6 }}>{stage.current_stage.description}</p>
                  )}
                  {(stage.current_stage?.actions || []).slice(0, 4).map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: '0.81rem' }}>
                      <CheckCircle size={14} color="#66bb6a" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ color: '#2e7d32', lineHeight: 1.5 }}>{a}</span>
                    </div>
                  ))}
                  {stage.next_stage && (
                    <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 9, background: 'rgba(171,71,188,0.08)', border: '1px solid rgba(171,71,188,0.2)' }}>
                      <div style={{ fontSize: '0.71rem', color: '#ab47bc', marginBottom: 3 }}>Next Stage</div>
                      <div style={{ fontWeight: 600, fontSize: '0.84rem' }}>{stage.next_stage.name}</div>
                      <div style={{ fontSize: '0.73rem', color: '#4a6650' }}>in {stage.next_stage.starts_in_days} days</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.84rem', color: '#4a6650', marginBottom: 16, lineHeight: 1.7 }}>{stage?.message || 'Add a sowing date to your field to enable crop stage tracking.'}</p>
                  <button className="btn btn-secondary" style={{ fontSize: '0.8rem', width: '100%' }} onClick={() => navigate('/fields')}>Set Sowing Date</button>
                </>
              )}
              <button className="btn btn-ghost" style={{ marginTop: 14, width: '100%', fontSize: '0.79rem' }} onClick={() => navigate('/advisory')}>
                Full Advisory <ChevronRight size={13} />
              </button>
            </div>

            <div className="card">
              <CardHeader icon={<Droplets size={18} />} title="Soil Moisture — SMAP"
                onExplain={() => openModal('Soil Moisture — What it means', buildExplainSoilMoisture(soilMoisture))} />
              {soilMoisture ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 18 }}>
                    <SoilGauge value={soilMoisture.surface_sm}    label="Surface (0–5 cm)"    color="#42a5f5" />
                    <SoilGauge value={soilMoisture.subsurface_sm} label="Root Zone (5–50 cm)" color="#0d8abc" />
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#4a6650', lineHeight: 1.7, marginBottom: 12 }}>
                    {soilMoisture.date ? `Reading from ${soilMoisture.date}.` : 'Latest available reading.'} NASA SMAP at 10 km resolution.
                  </div>
                  {soilMoisture.surface_sm != null && (() => {
                    const sm = soilMoisture.surface_sm;
                    const dry = sm < 0.2, wet = sm > 0.55;
                    return (
                      <div style={{ padding: '10px 12px', borderRadius: 9, fontSize: '0.8rem', background: dry ? 'rgba(239,83,80,0.08)' : wet ? 'rgba(66,165,245,0.08)' : 'rgba(102,187,106,0.08)', border: `1px solid ${dry ? 'rgba(239,83,80,0.2)' : wet ? 'rgba(66,165,245,0.2)' : 'rgba(102,187,106,0.2)'}`, color: dry ? '#ef5350' : wet ? '#42a5f5' : '#66bb6a' }}>
                        {dry ? '⚠️ Dry — Irrigation recommended' : wet ? '💧 Saturated — Risk of waterlogging' : '✓ Optimal moisture for crop growth'}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="text-muted" style={{ fontSize: '0.84rem', lineHeight: 1.7 }}>SMAP data unavailable for this location.</p>
              )}
            </div>

            <div className="card">
              <CardHeader icon={<TrendingUp size={18} />} title="Mandi Prices"
                onExplain={() => openModal('Mandi Prices — How to use them', buildExplainMarket(marketPrices, activeField.crop_type))} />
              {marketPrices.length > 0 ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.71rem', color: '#4a6650', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{activeField.crop_type}</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 700, color: '#66bb6a', lineHeight: 1.1 }}>
                      ₹{topMarket?.modal_price?.toLocaleString() ?? '—'}
                      <span style={{ fontSize: '0.8rem', color: '#4a6650', fontWeight: 400 }}>/qt</span>
                    </div>
                    <div style={{ fontSize: '0.77rem', color: '#4a6650', marginTop: 4 }}>{topMarket?.mandi}, {topMarket?.state}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div style={{ padding: '8px 12px', borderRadius: 9, background: 'rgba(102,187,106,0.08)', border: '1px solid rgba(102,187,106,0.15)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#4a6650', marginBottom: 2 }}>Min Price</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#66bb6a' }}>₹{topMarket?.min_price?.toLocaleString() ?? '—'}</div>
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: 9, background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.15)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#4a6650', marginBottom: 2 }}>Max Price</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffb300' }}>₹{topMarket?.max_price?.toLocaleString() ?? '—'}</div>
                    </div>
                  </div>
                  <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                    {marketPrices.slice(0, 6).map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(67,160,71,0.05)', fontSize: '0.79rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.mandi}</div>
                          <div style={{ fontSize: '0.68rem', color: '#4a6650' }}>{m.state}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, color: '#66bb6a' }}>₹{m.modal_price?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.68rem', color: '#4a6650' }}>{m.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-muted" style={{ fontSize: '0.84rem' }}>Market data unavailable for {activeField.crop_type}.</p>
              )}
            </div>
          </div>

          {/* ── Row 4: Advisory + Alerts ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            <div className="card">
              <CardHeader icon={<Zap size={18} />} title="Crop Advisories"
                badge={cards.length > 0 ? <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: '0.73rem', fontWeight: 600, background: 'rgba(255,179,0,0.15)', color: '#ffb300', border: '1px solid rgba(255,179,0,0.3)' }}>{cards.length}</span> : null}
                onExplain={() => openModal('Crop Advisories — How they work', buildExplainAdvisory())} />
              {cards.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.84rem' }}>No advisories yet. Fetch satellite indices to generate recommendations.</p>
              ) : (
                <>
                  {cards.filter(c => c.severity !== 'danger').slice(0, 5).map((c, i) => <AdvisoryCard key={i} card={c} />)}
                  {cards.length > 5 && (
                    <button className="btn btn-ghost" style={{ width: '100%', fontSize: '0.8rem', marginTop: 6 }} onClick={() => navigate('/advisory')}>
                      View all {cards.length} advisories <ChevronRight size={13} />
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="card">
              <CardHeader icon={<Bell size={18} />} title="Alerts"
                badge={
                  <div className="flex gap-6">
                    {(alertSummary?.high ?? 0) > 0 && <span className="badge badge-red">{alertSummary.high} high</span>}
                    {(alertSummary?.medium ?? 0) > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(255,179,0,0.15)', color: '#ffb300', border: '1px solid rgba(255,179,0,0.3)' }}>{alertSummary.medium} med</span>}
                  </div>
                }
                onExplain={() => openModal('Alerts — What they mean', buildExplainAlerts())} />
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <CheckCircle size={32} color="#66bb6a" style={{ marginBottom: 10 }} />
                  <p className="text-muted" style={{ fontSize: '0.84rem' }}>No unacknowledged alerts — all clear!</p>
                </div>
              ) : (
                <>
                  {alerts.slice(0, 5).map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(67,160,71,0.05)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <AlertTriangle size={14} color={a.severity === 'high' ? '#ef5350' : a.severity === 'medium' ? '#ffb300' : '#66bb6a'} />
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: a.severity === 'high' ? '#ef5350' : '#ffb300' }}>
                            {a.alert_type?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.77rem', color: '#4a6650', lineHeight: 1.5, paddingRight: 10 }}>
                          {a.message?.slice(0, 90)}{(a.message?.length ?? 0) > 90 ? '…' : ''}
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.7rem', padding: '4px 10px', flexShrink: 0 }}
                        onClick={() => acknowledgeAlert(a.id).then(() => setAlerts(prev => prev.filter(x => x.id !== a.id)))}
                      >
                        ACK
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ width: '100%', fontSize: '0.8rem', marginTop: 10 }} onClick={() => navigate('/alerts')}>
                    View all alerts <ChevronRight size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
