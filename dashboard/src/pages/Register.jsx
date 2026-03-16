import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Leaf, Mail, Lock, User, Phone, MapPin,
  Loader, AlertCircle, Satellite, Bug, CloudRain, BarChart3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import './Auth.css';

import { INDIAN_STATES, DISTRICTS_BY_STATE } from '../utils/indiaData';

const ROLES = [
  { value: 'farmer',     label: '👨‍🌾 Farmer' },
  { value: 'agronomist', label: '🔬 Agronomist' },
  { value: 'admin',      label: '⚙️ Admin' },
];

const FEATURES = [
  { icon: Satellite,  text: 'Sentinel-2 satellite indices (NDVI, EVI, NDWI + 5 more)' },
  { icon: Bug,        text: 'AI-powered disease detection & pest risk assessment' },
  { icon: CloudRain,  text: 'Real-time weather, soil moisture & 7-day forecasts' },
  { icon: BarChart3,  text: 'Mandi price alerts & PDF field health reports' },
];

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '',
    role: 'farmer', language: 'en', phone: '', state: '', district: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp({
        email:    form.email,
        password: form.password,
        name:     form.name,
        role:     form.role,
        language: form.language,
        phone:    form.phone || undefined,
        state:    form.state || undefined,
        district: form.district || undefined,
      });
      setSuccess('Account created! Setting up your farm…');
      toast.success('Welcome to Croppy!');
      setTimeout(() => navigate('/onboard'), 1800);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      {/* ── Brand Panel ─────────────────────────────────────────── */}
      <div className="auth-brand">
        <div className="auth-brand-logo">
          <div className="auth-brand-icon"><Leaf size={26} /></div>
          <div>
            <div className="auth-brand-name">Croppy</div>
            <div className="auth-brand-sub">Precision Ag Platform</div>
          </div>
        </div>
        <h1>Smart farming<br />starts <span>here</span></h1>
        <p className="auth-brand-desc">
          Join thousands of farmers already using satellite intelligence,
          AI disease detection and real-time alerts to protect their crops.
        </p>
        <div className="auth-features">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="auth-feature">
              <div className="auth-feature-icon"><Icon size={16} /></div>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form Panel ──────────────────────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <h2>Create account</h2>
          <p className="auth-form-subtitle">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>

          {error   && <div className="auth-error"><AlertCircle size={16} />{error}</div>}
          {success && <div className="auth-success">✅ {success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="input" placeholder="Arjun Singh"
                  value={form.name} onChange={e => update('name', e.target.value)} required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select className="select" value={form.role} onChange={e => update('role', e.target.value)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                className="input" type="email" placeholder="arjun@example.com"
                value={form.email} onChange={e => update('email', e.target.value)} required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <input
                  className="input" type="password" placeholder="Min 6 characters"
                  value={form.password} onChange={e => update('password', e.target.value)} required
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  className="input" type="password" placeholder="Repeat password"
                  value={form.confirm} onChange={e => update('confirm', e.target.value)} required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone (optional)</label>
                <input
                  className="input" placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => update('phone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Language</label>
                <select className="select" value={form.language} onChange={e => update('language', e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="pa">Punjabi</option>
                  <option value="te">Telugu</option>
                  <option value="ta">Tamil</option>
                  <option value="kn">Kannada</option>
                  <option value="mr">Marathi</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>State</label>
                <select className="select" value={form.state} onChange={e => update('state', e.target.value)}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>District</label>
                <select
                  className="select"
                  value={form.district}
                  onChange={e => update('district', e.target.value)}
                  disabled={!form.state}
                >
                  <option value="">{form.state ? 'Select district' : 'Select state first'}</option>
                  {(DISTRICTS_BY_STATE[form.state] || []).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? <Loader size={18} className="spin" /> : <User size={18} />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Google OAuth */}
          <div className="auth-divider">or continue with</div>
          <button
            type="button"
            className="google-btn"
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/' },
              });
              if (error) toast.error(error.message);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 33.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 5.8 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.7-.4-3.9z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.5 18.8 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 5.8 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5 0 9.6-1.6 13.2-4.4l-6.1-5.2C29.2 35.5 26.7 36 24 36c-5.2 0-9.6-2.4-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.2 5.4l6.1 5.2C36.5 39.2 44 34 44 24c0-1.3-.2-2.7-.4-3.9z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
