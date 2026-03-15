import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Leaf, Loader, AlertCircle, Satellite, Bug, CloudRain, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import './Auth.css';

const FEATURES = [
  { icon: Satellite,  text: 'Live Sentinel-2 vegetation indices' },
  { icon: Bug,        text: 'AI disease detection & pest risk' },
  { icon: CloudRain,  text: 'Weather + 7-day stress forecasts' },
  { icon: BarChart3,  text: 'Market prices & PDF reports' },
];

export default function Login() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { signIn } = useAuth();

  const from = location.state?.from?.pathname || '/';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn({ email, password });
      toast.success('Welcome back! 🌿');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password');
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
        <h1>AI-powered<br /><span>crop health</span><br />monitoring</h1>
        <p className="auth-brand-desc">
          Detect diseases early, track vegetation health from space,
          and never miss a pest outbreak — all in one platform.
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
          <h2>Welcome back</h2>
          <p className="auth-form-subtitle">
            New to Croppy?{' '}
            <Link to="/register">Create a free account</Link>
          </p>

          {error && (
            <div className="auth-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                className="input"
                type="email"
                placeholder="arjun@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Password</label>
              <input
                className="input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 24 }}>
              <a
                href="#"
                style={{ fontSize: '0.82rem', color: 'var(--green-400)', textDecoration: 'none' }}
                onClick={e => { e.preventDefault(); toast('Password reset via email — contact admin for now'); }}
              >
                Forgot password?
              </a>
            </div>

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? <Loader size={18} className="spin" /> : <Leaf size={18} />}
              {loading ? 'Signing in…' : 'Sign In'}
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

          <div style={{
            marginTop: 20, padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.78rem',
            color: 'var(--text-dim)',
            textAlign: 'center',
          }}>
            SIH 2025 — Problem ID: 25099 | MathWorks India
          </div>
        </div>
      </div>
    </div>
  );
}
