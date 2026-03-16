import { useState } from 'react';
import { Leaf, Droplet, ThermometerSun, Sprout, AlertTriangle, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

// Dummy data
const trendData = [
  { date: 'Jan 5', health: 3 },
  { date: 'Feb 10', health: 3.2 },
  { date: 'Mar 1', health: 3.5 },
  { date: 'Mar 16', health: 3.5 },
];

export default function Analysis() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Prepare nursery beds (Best before 10 AM)', done: false },
    { id: 2, text: 'Treat seeds with Carbendazim 0.2%', done: false },
  ]);

  const toggleTask = (id) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const [showTech, setShowTech] = useState(false);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header Info */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', color: '#1b5e20' }}>🌾 My Rice Field</h1>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a6650' }}>Andhra Pradesh · 0.06 ha · Updated: 15 min ago</p>
      </div>

      {/* Hero Status */}
      <div style={{ background: '#FEF9C3', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '20px', border: '1px solid #FDE047' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#CA8A04' }}>YOUR CROP IS 🟡 OKAY</h2>
        <p style={{ margin: 0, fontSize: '1rem', color: '#A16207', fontWeight: '500' }}>Some areas need attention</p>
      </div>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#1c2723', padding: '16px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)' }}>
          <Droplet size={24} color="#60A5FA" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', color: '#4a6650' }}>Water</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b5e20' }}>Low</div>
        </div>
        <div style={{ background: '#1c2723', padding: '16px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)' }}>
          <ThermometerSun size={24} color="#FBBF24" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', color: '#4a6650' }}>Weather</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b5e20' }}>25°C Clear</div>
        </div>
        <div style={{ background: '#1c2723', padding: '16px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)' }}>
          <Sprout size={24} color="#4ADE80" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', color: '#4a6650' }}>Crop Stage</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b5e20' }}>Day 3 (Nursery)</div>
        </div>
        <div style={{ background: '#1c2723', padding: '16px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)' }}>
          <AlertTriangle size={24} color="#4a6650" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '0.85rem', color: '#4a6650' }}>Alerts</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b5e20' }}>0 Alerts</div>
        </div>
      </div>

      {/* What To Do Today */}
      <div style={{ background: '#1c2723', padding: '20px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#66bb6a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📋 WHAT TO DO TODAY
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleTask(t.id)}>
              {t.done ? <CheckSquare color="#66bb6a" className="mt-1" size={20} /> : <Square color="#4a6650" className="mt-1" size={20} />}
              <div style={{ fontSize: '1rem', color: t.done ? '#6b8a72' : '#1b5e20', textDecoration: t.done ? 'line-through' : 'none', lineHeight: '1.4' }}>
                {t.text}
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(67,160,71,0.12)' }}>
          <div style={{ fontSize: '0.85rem', color: '#4a6650', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>📅 Coming Up</div>
          <div style={{ fontSize: '0.95rem', color: '#1b5e20' }}>• Transplanting → in 22 days</div>
          <div style={{ fontSize: '0.95rem', color: '#1b5e20', marginTop: '4px' }}>• First fertilizer → in 30 days</div>
        </div>
      </div>

      {/* Field Map Placeholder */}
      <div style={{ background: '#1c2723', padding: '20px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#1b5e20' }}>🗺️ FIELD MAP</h3>
        <div style={{ height: '200px', background: '#253028', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <span style={{ color: '#6b8a72' }}>[Satellite image with 3-color overlay]</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
          <span style={{ color: '#4ADE80' }}>🟢 Healthy 78%</span>
          <span style={{ color: '#FCD34D' }}>🟡 Watch 18%</span>
          <span style={{ color: '#F87171' }}>🔴 Problem 4%</span>
        </div>
        <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#4a6650' }}>Tap any area ☝️</div>
      </div>

      {/* Trend Graph */}
      <div style={{ background: '#1c2723', padding: '20px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1b5e20' }}>📈 CROP HEALTH TREND</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '0.95rem', color: '#66bb6a' }}>"Steady this week ↔️"</p>
        
        <div style={{ height: '180px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#253028" vertical={false} />
              <XAxis dataKey="date" stroke="#6b8a72" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#6b8a72" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                ticks={[1, 2, 3, 4]}
                tickFormatter={(val) => {
                  if(val === 4) return 'Excellent';
                  if(val === 3) return 'Good';
                  if(val === 2) return 'Fair';
                  if(val === 1) return 'Poor';
                  return '';
                }}
              />
              <Line type="monotone" dataKey="health" stroke="#4ADE80" strokeWidth={3} dot={{ fill: '#4ADE80', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', color: '#4a6650', textAlign: 'center' }}>📊 Your crop is on track compared to last year</p>
      </div>

      {/* Weather */}
      <div style={{ background: '#1c2723', padding: '20px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1b5e20' }}>🌧️ WEATHER FORECAST</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#4a6650', marginBottom: '4px' }}>TODAY</div>
            <div style={{ fontSize: '1rem', color: '#1b5e20' }}>🌤️ 25°C Clear</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#4a6650', marginBottom: '4px' }}>THIS WEEK</div>
            <div style={{ fontSize: '1rem', color: '#1b5e20' }}>🌧️ Rain expected Thu</div>
            <div style={{ fontSize: '1rem', color: '#1b5e20' }}>💨 Windy on Fri</div>
          </div>
        </div>
        <div style={{ background: 'rgba(102,187,106,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(102,187,106,0.2)' }}>
          <div style={{ fontSize: '0.85rem', color: '#66bb6a', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Spray Window</div>
          <div style={{ fontSize: '0.95rem', color: '#1b5e20' }}>✅ Today & tomorrow are good for spraying</div>
          <div style={{ fontSize: '0.85rem', color: '#4a6650', marginTop: '2px' }}>Low wind, no rain expected</div>
        </div>
      </div>

      {/* Market Prices */}
      <div style={{ background: '#1c2723', padding: '20px', borderRadius: '12px', border: '1px solid rgba(67,160,71,0.12)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1b5e20' }}>💰 MARKET PRICES</h3>
        <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#1b5e20', marginBottom: '16px' }}>
          Rice: ₹2,150 <span style={{ fontSize: '0.9rem', color: '#66bb6a', fontWeight: 'normal' }}>↑ ₹50 this week</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem', color: '#1b5e20' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#4a6650' }}>Nearest mandi:</span>
            <span>Guntur (12 km)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#4a6650' }}>Best price:</span>
            <span>Vijayawada (₹2,200)</span>
          </div>
        </div>
        <div style={{ marginTop: '16px', background: 'rgba(38,198,218,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(38,198,218,0.2)', fontSize: '0.9rem', color: '#1b5e20' }}>
          💡 Prices have been rising. Consider selling within 2 weeks if you have stock.
        </div>
      </div>

      {/* Show Technical Details */}
      <div>
        <button 
          onClick={() => setShowTech(!showTech)} 
          style={{ width: '100%', padding: '16px', background: 'transparent', border: '1px solid rgba(67,160,71,0.12)', borderRadius: '12px', color: '#4a6650', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          {showTech ? 'Hide Technical Details' : 'Show Technical Details'}
          <ChevronDown size={18} style={{ transform: showTech ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        
        {showTech && (
          <div style={{ padding: '20px', background: '#ffffff', border: '1px solid rgba(67,160,71,0.12)', borderRadius: '12px', marginTop: '12px', fontSize: '0.85rem', color: '#6b8a72', lineHeight: '1.6', fontFamily: 'monospace' }}>
            NDVI:  0.201 (Moderate)<br/>
            EVI:   0.221 (Moderate)<br/>
            NDWI: -0.221 (Low)<br/>
            NDRE:  0.128 (Low)<br/>
            SAVI:  0.158 (Low)<br/>
            MSAVI: 0.148 (Low)<br/>
            BSI:   0.021 (Good)<br/>
            NDMI:  0.017 (Moderate)<br/>
            <br/>
            Source: Sentinel-2<br/>
            Images: 11 composited<br/>
            Resolution: 10m<br/>
            Last capture: Mar 14, 2026<br/>
            Cloud cover: 12%<br/>
            <br/>
            Soil Moisture (SMAP)<br/>
            Surface: 0%   Root zone: 0%<br/>
            Resolution: 10 km
          </div>
        )}
      </div>

    </div>
  );
}
