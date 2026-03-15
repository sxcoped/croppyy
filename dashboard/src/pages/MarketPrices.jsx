import { useState } from 'react';
import { Wheat, Search, TrendingUp, TrendingDown, Loader } from 'lucide-react';
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

export default function MarketPrices() {
  const [crop, setCrop] = useState('wheat');
  const [state, setState] = useState('');
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetch_prices() {
    setLoading(true);
    // Try API first, fall back to mock
    try {
      const res = await getMarketPrices(crop, state);
      setPrices(res.data.prices || []);
    } catch {
      // Use mock data
      let data = MOCK_PRICES[crop] || [];
      if (state) data = data.filter(p => p.state.toLowerCase().includes(state.toLowerCase()));
      setPrices(data);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Market Prices (Mandi)</h1>
        <p>Latest agricultural commodity prices from mandis across India</p>
      </div>

      {/* Search */}
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
        </div>
      </div>

      {/* Price table */}
      {prices.length > 0 && (
        <div className="card animate-in">
          <div className="card-header">
            <div className="card-title"><Wheat size={18} /> Mandi Prices — {crop.charAt(0).toUpperCase() + crop.slice(1)}</div>
            <span className="badge badge-green">{prices.length} mandis</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mandi</th><th>State</th><th>Min (₹/qtl)</th><th>Max (₹/qtl)</th><th>Modal (₹/qtl)</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.mandi}</strong></td>
                    <td>{p.state}</td>
                    <td style={{ color: 'var(--accent-orange)' }}>₹{p.min_price.toLocaleString()}</td>
                    <td style={{ color: 'var(--green-400)' }}>₹{p.max_price.toLocaleString()}</td>
                    <td>
                      <strong style={{ fontSize: '1.1rem' }}>₹{p.modal_price.toLocaleString()}</strong>
                    </td>
                    <td className="text-muted">{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {prices.length === 0 && !loading && (
        <div className="card">
          <div className="loading-overlay">
            <Wheat size={40} color="var(--text-dim)" />
            <p>Select a crop and click "Get Prices" to view mandi rates</p>
          </div>
        </div>
      )}
    </div>
  );
}
