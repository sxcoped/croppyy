import { useState } from 'react';
import { Wheat, Search, TrendingUp, TrendingDown, Loader, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMarketPrices } from '../utils/api';

const STATES = ['Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Andhra Pradesh', 'Gujarat', 'Rajasthan'];
const CROPS = ['Wheat', 'Rice', 'Maize', 'Cotton', 'Potato', 'Tomato', 'Onion', 'Soybean', 'Sugarcane', 'Mustard'];

// Mock mandi prices for demo
const MOCK_PRICES = {
  wheat: [
    { mandi: 'Ludhiana', state: 'Punjab', min_price: 2125, max_price: 2275, modal_price: 2200, date: '2026-03-10' },
    { mandi: 'Karnal', state: 'Haryana', min_price: 2100, max_price: 2250, modal_price: 2175, date: '2026-03-10' },
    { mandi: 'Agra', state: 'Uttar Pradesh', min_price: 2050, max_price: 2200, modal_price: 2125, date: '2026-03-09' },
    { mandi: 'Indore', state: 'Madhya Pradesh', min_price: 2080, max_price: 2220, modal_price: 2150, date: '2026-03-09' },
  ],
  rice: [
    { mandi: 'Amritsar', state: 'Punjab', min_price: 2100, max_price: 2320, modal_price: 2210, date: '2026-03-10' },
    { mandi: 'Panipat', state: 'Haryana', min_price: 2050, max_price: 2280, modal_price: 2165, date: '2026-03-10' },
    { mandi: 'Thanjavur', state: 'Tamil Nadu', min_price: 1980, max_price: 2150, modal_price: 2065, date: '2026-03-09' },
  ],
  cotton: [
    { mandi: 'Rajkot', state: 'Gujarat', min_price: 6350, max_price: 6800, modal_price: 6575, date: '2026-03-10' },
    { mandi: 'Nagpur', state: 'Maharashtra', min_price: 6200, max_price: 6700, modal_price: 6450, date: '2026-03-09' },
  ],
  potato: [
    { mandi: 'Agra', state: 'Uttar Pradesh', min_price: 620, max_price: 850, modal_price: 735, date: '2026-03-10' },
    { mandi: 'Jalandhar', state: 'Punjab', min_price: 650, max_price: 880, modal_price: 765, date: '2026-03-10' },
  ],
  tomato: [
    { mandi: 'Nashik', state: 'Maharashtra', min_price: 1200, max_price: 2100, modal_price: 1650, date: '2026-03-10' },
    { mandi: 'Kolar', state: 'Karnataka', min_price: 1100, max_price: 1900, modal_price: 1500, date: '2026-03-09' },
  ],
};

const EMPTY_ENTRY = { mandi: '', state: '', crop: 'wheat', min_price: '', max_price: '', modal_price: '', date: new Date().toISOString().slice(0, 10) };

export default function MarketPrices() {
  const [crop, setCrop] = useState('wheat');
  const [state, setState] = useState('');
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [customPrices, setCustomPrices] = useState([]);

  async function fetch_prices() {
    setLoading(true);
    try {
      const res = await getMarketPrices(crop, state);
      setPrices(res.data.prices || []);
    } catch {
      let data = MOCK_PRICES[crop] || [];
      if (state) data = data.filter(p => p.state.toLowerCase().includes(state.toLowerCase()));
      setPrices(data);
    }
    setLoading(false);
  }

  function setE(key, val) { setEntry(e => ({ ...e, [key]: val })); }

  function addEntry(ev) {
    ev.preventDefault();
    if (!entry.mandi || !entry.state || !entry.modal_price) {
      toast.error('Mandi name, state and modal price are required');
      return;
    }
    const newEntry = {
      ...entry,
      min_price:   entry.min_price   ? parseInt(entry.min_price)   : parseInt(entry.modal_price),
      max_price:   entry.max_price   ? parseInt(entry.max_price)   : parseInt(entry.modal_price),
      modal_price: parseInt(entry.modal_price),
      _custom: true,
    };
    setCustomPrices(cp => [newEntry, ...cp]);
    setEntry(EMPTY_ENTRY);
    setShowAddForm(false);
    toast.success(`Added ${entry.mandi} mandi entry`);
  }

  function removeCustom(i) {
    setCustomPrices(cp => cp.filter((_, idx) => idx !== i));
  }

  const displayPrices = [
    ...customPrices.filter(p => p.crop === crop && (!state || p.state.toLowerCase().includes(state.toLowerCase()))),
    ...prices,
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Market Prices (Mandi)</h1>
        <p>Latest agricultural commodity prices from mandis across India</p>
      </div>

      {/* Search + Add */}
      <div className="card mb-24">
        <div className="flex gap-16 items-center" style={{ flexWrap: 'wrap' }}>
          <div>
            <label>Crop</label>
            <select className="select" value={crop} onChange={e => setCrop(e.target.value.toLowerCase())}>
              {CROPS.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>State (optional)</label>
            <select className="select" value={state} onChange={e => setState(e.target.value)}>
              <option value="">All States</option>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={fetch_prices} disabled={loading} style={{ alignSelf: 'flex-end' }}>
            {loading ? <Loader size={16} /> : <Search size={16} />}
            {loading ? 'Loading…' : 'Get Prices'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setShowAddForm(v => !v)}
            style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
          >
            <Plus size={16} /> Add Mandi Entry
          </button>
        </div>
      </div>

      {/* Manual entry form */}
      {showAddForm && (
        <div className="card mb-24 animate-in" style={{ border: '1px solid rgba(67,160,71,0.25)' }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div className="card-title"><Plus size={18} /> Add Mandi Price</div>
            <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setShowAddForm(false)}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={addEntry}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div>
                <label>Mandi Name *</label>
                <input className="input" style={{ width: '100%' }} placeholder="e.g. Ludhiana" value={entry.mandi} onChange={e => setE('mandi', e.target.value)} />
              </div>
              <div>
                <label>State *</label>
                <select className="input" style={{ width: '100%' }} value={entry.state} onChange={e => setE('state', e.target.value)}>
                  <option value="">Select state</option>
                  {STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Crop</label>
                <select className="input" style={{ width: '100%' }} value={entry.crop} onChange={e => setE('crop', e.target.value)}>
                  {CROPS.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>Min Price (₹/qtl)</label>
                <input className="input" style={{ width: '100%' }} type="number" placeholder="e.g. 2100" value={entry.min_price} onChange={e => setE('min_price', e.target.value)} />
              </div>
              <div>
                <label>Max Price (₹/qtl)</label>
                <input className="input" style={{ width: '100%' }} type="number" placeholder="e.g. 2300" value={entry.max_price} onChange={e => setE('max_price', e.target.value)} />
              </div>
              <div>
                <label>Modal Price (₹/qtl) *</label>
                <input className="input" style={{ width: '100%' }} type="number" placeholder="e.g. 2200" value={entry.modal_price} onChange={e => setE('modal_price', e.target.value)} />
              </div>
              <div>
                <label>Date</label>
                <input className="input" style={{ width: '100%' }} type="date" value={entry.date} onChange={e => setE('date', e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              <Plus size={16} /> Add Entry
            </button>
          </form>
        </div>
      )}

      {/* Price table */}
      {displayPrices.length > 0 && (
        <div className="card animate-in">
          <div className="card-header">
            <div className="card-title"><Wheat size={18} /> Mandi Prices — {crop.charAt(0).toUpperCase() + crop.slice(1)}</div>
            <span className="badge badge-green">{displayPrices.length} mandis</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mandi</th><th>State</th><th>Min (₹/qtl)</th><th>Max (₹/qtl)</th><th>Modal (₹/qtl)</th><th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {displayPrices.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{p.mandi}</strong>
                      {p._custom && <span className="badge badge-cyan" style={{ marginLeft: 6, fontSize: '0.65rem' }}>manual</span>}
                    </td>
                    <td>{p.state}</td>
                    <td style={{ color: 'var(--accent-orange)' }}>₹{p.min_price.toLocaleString()}</td>
                    <td style={{ color: 'var(--green-400)' }}>₹{p.max_price.toLocaleString()}</td>
                    <td><strong style={{ fontSize: '1.1rem' }}>₹{p.modal_price.toLocaleString()}</strong></td>
                    <td className="text-muted">{p.date}</td>
                    <td>
                      {p._custom && (
                        <button
                          onClick={() => removeCustom(customPrices.indexOf(p))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef5350', padding: 4 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {displayPrices.length === 0 && !loading && (
        <div className="card">
          <div className="loading-overlay">
            <Wheat size={40} color="var(--text-dim)" />
            <p>Select a crop and click "Get Prices" to view mandi rates</p>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Or use "Add Mandi Entry" to log prices manually</p>
          </div>
        </div>
      )}
    </div>
  );
}
