import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Satellite, Bug, CloudRain, BarChart3, ArrowRight, CheckCircle2, Star, Shield, Smartphone } from 'lucide-react';
import { ContainerScroll, BentoGrid, BentoCell, ContainerScale } from '@/components/blocks/hero-gallery-scroll-animation';

const IMAGES = [
  'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
];

const GALLERY = [
  'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&auto=format&fit=crop&q=80',
];

const F = [
  { icon: Satellite,  t: 'Satellite Intelligence',    d: 'NDVI, EVI, NDWI + 5 more indices from Sentinel-2 every 5 days.' },
  { icon: Bug,        t: 'AI Disease Detection',      d: 'Snap a leaf — CNN classifies 38 diseases across 14 crops in 2 sec.' },
  { icon: CloudRain,  t: 'Weather & Stress Forecast', d: '7-day LSTM stress probability + real-time NASA POWER data.' },
  { icon: BarChart3,  t: 'Mandi Market Prices',       d: 'Live Agmarknet prices so you sell at the right time, right mandi.' },
  { icon: Shield,     t: 'Pest Risk Alerts',          d: 'Push alerts when weather favours pests. Rule-engine + ML hybrid.' },
  { icon: Smartphone, t: 'PDF Reports',               d: 'Download field health reports as PDF — works offline for buyers.' },
];

const imgFull = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };

/* ── cell grid positions (CSS grid area) ─── */
const cellStyles = [
  { gridColumn: '1 / 7', gridRow: '1 / 4' },
  { gridColumn: '7 / 9', gridRow: '1 / 3' },
  { gridColumn: '7 / 9', gridRow: '3 / 5' },
  { gridColumn: '1 / 4', gridRow: '4 / 5' },
  { gridColumn: '4 / 7', gridRow: '4 / 5' },
];

const s = {
  page: { background: '#fff', color: '#111', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", overflowX: 'hidden' },
  nav: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e8f5e9' },
  navInner: { maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#43a047,#2e7d32)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge: { fontSize: 10, padding: '2px 8px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 99, fontWeight: 700 },
  signIn: { padding: '7px 16px', fontSize: 14, fontWeight: 600, color: '#555', textDecoration: 'none', borderRadius: 8 },
  getStarted: { padding: '7px 18px', fontSize: 14, fontWeight: 700, color: '#fff', background: '#43a047', borderRadius: 8, textDecoration: 'none', border: 'none' },
  heroText: { textAlign: 'center', padding: '0 24px' },
  pill: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', border: '1px solid #c8e6c9', color: '#2e7d32', fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 99, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  h1: { fontSize: 'clamp(32px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.08, color: '#111', letterSpacing: '-1.5px', margin: '0 0 16px' },
  h1Green: { color: '#43a047' },
  subtitle: { fontSize: 17, color: '#666', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 28px' },
  btns: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', background: '#43a047', color: '#fff', fontSize: 15, fontWeight: 700, borderRadius: 12, textDecoration: 'none', boxShadow: '0 6px 20px rgba(67,160,71,0.35)', border: 'none', cursor: 'pointer' },
  btnOutline: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', border: '1.5px solid #ddd', color: '#555', fontSize: 15, fontWeight: 600, borderRadius: 12, textDecoration: 'none', background: '#fff', cursor: 'pointer' },
  subtext: { fontSize: 12, color: '#aaa', marginTop: 14 },
  section: { position: 'relative', zIndex: 10, background: '#fff' },
};

export default function Landing() {
  useEffect(() => {
    const prev = document.body.style.cssText;
    document.body.style.background = '#ffffff';
    document.body.style.color = '#111111';
    return () => { document.body.style.cssText = prev; };
  }, []);

  return (
    <div style={s.page}>

      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={s.logo}>
            <div style={s.logoIcon}><Leaf size={16} color="#fff" /></div>
            <span style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>Croppy</span>
            <span style={s.badge}>SIH 2025</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link to="/login" style={s.signIn}>Sign in</Link>
            <Link to="/register" style={s.getStarted}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* HERO — SCROLL ANIMATION */}
      <ContainerScroll style={{ height: '350vh' }}>
        <BentoGrid>
          {IMAGES.map((src, i) => (
            <BentoCell key={i} gridArea={cellStyles[i]}>
              <img src={src} alt="" style={imgFull} />
            </BentoCell>
          ))}
        </BentoGrid>
        <ContainerScale>
          <div style={s.heroText}>
            <div style={s.pill}><Satellite size={14} /> Powered by Sentinel-2 + AI</div>
            <h1 style={s.h1}>Your crops,<br /><span style={s.h1Green}>watched from space</span></h1>
            <p style={s.subtitle}>
              AI-powered crop health monitoring for Indian farmers.
              Detect disease, track vegetation, forecast stress — before damage is done.
            </p>
            <div style={s.btns}>
              <Link to="/register" style={s.btnPrimary}>Start Monitoring Free <ArrowRight size={16} /></Link>
              <Link to="/login" style={s.btnOutline}>Sign In</Link>
            </div>
            <p style={s.subtext}>Free for farmers · No credit card · SIH 25099</p>
          </div>
        </ContainerScale>
      </ContainerScroll>

      {/* ─── EVERYTHING BELOW: z-10 so it paints above sticky hero ─── */}

      {/* STATS */}
      <section style={{ ...s.section, background: 'linear-gradient(135deg,#2e7d32,#43a047)', padding: '44px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, textAlign: 'center' }}>
          {[{ v:'38', l:'Disease Classes' },{ v:'8', l:'Vegetation Indices' },{ v:'14', l:'Crop Varieties' },{ v:'5-day', l:'Revisit Cycle' }].map(({ v, l }) => (
            <div key={l}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>{v}</div>
              <div style={{ fontSize: 13, color: '#c8e6c9', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ ...s.section, background: '#f9fafb', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#43a047', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 10 }}>Platform</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: '#111', margin: 0 }}>Everything your farm needs</h2>
            <p style={{ fontSize: 15, color: '#888', marginTop: 12, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>From satellite imagery to AI inference — the full precision agriculture stack.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {F.map(({ icon: I, t, d }) => (
              <div key={t} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #eee', transition: 'box-shadow 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.07)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <I size={20} color="#43a047" />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111', marginBottom: 6 }}>{t}</div>
                <div style={{ fontSize: 14, color: '#777', lineHeight: 1.6 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ ...s.section, padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#43a047', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 10 }}>Process</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: '#111', margin: 0 }}>How Croppy works</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }}>
            {[{ n: 1, t: 'Register your field', d: 'Drop a pin, name your plot, pick your crop. Sentinel-2 data streams automatically.' },
              { n: 2, t: 'Get AI analysis',      d: 'Satellite indices + disease scan + pest risk — computed in seconds.' },
              { n: 3, t: 'Act on alerts',         d: 'Get notified before damage happens. Download PDF reports. Check mandi rates.' }
            ].map(({ n, t, d }) => (
              <div key={n}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#43a047', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, marginBottom: 14, boxShadow: '0 4px 12px rgba(67,160,71,0.3)' }}>{n}</div>
                <div style={{ fontWeight: 700, color: '#111', marginBottom: 6 }}>{t}</div>
                <div style={{ fontSize: 14, color: '#777', lineHeight: 1.6 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section style={{ ...s.section, background: '#f9fafb', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: '#111', margin: 0 }}>Built for Indian agriculture</h2>
            <p style={{ fontSize: 15, color: '#888', marginTop: 12 }}>Real satellite data. Real crop varieties. Real mandi prices.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {GALLERY.map((src, i) => (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '4/3' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ ...s.section, padding: '80px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: '#111', textAlign: 'center', marginBottom: 40 }}>Trusted by farmers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[{ n: 'Arjun Sharma', r: 'Wheat, Punjab', q: 'Caught a rust infection 3 weeks early. Saved my entire rabi crop.' },
              { n: 'Dr. Priya Nair', r: 'Agronomist, Kerala', q: 'Satellite indices match my ground-truth surveys. Remarkable.' },
              { n: 'Rajesh Patel', r: 'Cotton, Gujarat', q: 'Market alerts helped me hold 8 more days — ₹40k extra profit.' }
            ].map(({ n, r, q }) => (
              <div key={n} style={{ background: '#f9fafb', borderRadius: 14, padding: 22, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                  {[1,2,3,4,5].map(i => <Star key={i} size={13} fill="#ffc107" color="#ffc107" />)}
                </div>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 14 }}>"{q}"</p>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{n}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ ...s.section, background: 'linear-gradient(135deg,#43a047,#2e7d32)', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,5vw,42px)', fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 14 }}>Start protecting your crops today</h2>
          <p style={{ fontSize: 17, color: '#c8e6c9', marginBottom: 28 }}>Join farmers across India using satellite intelligence to grow smarter.</p>
          <div style={s.btns}>
            <Link to="/register" style={{ ...s.btnPrimary, background: '#fff', color: '#2e7d32', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              Create Free Account <ArrowRight size={16} />
            </Link>
            <Link to="/login" style={{ ...s.btnOutline, borderColor: 'rgba(255,255,255,0.3)', color: '#fff', background: 'transparent' }}>
              Sign In
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap', color: '#c8e6c9', fontSize: 13 }}>
            {['Free for farmers', 'No credit card', 'Made in India 🇮🇳'].map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={14} color="#a5d6a7" /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ ...s.section, background: '#111', padding: '28px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: '#43a047', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Leaf size={13} color="#fff" /></div>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>Croppy</span>
          </div>
          <span style={{ fontSize: 12, color: '#666' }}>SIH 2025 · Problem 25099 · MathWorks India</span>
          <div style={{ display: 'flex', gap: 14 }}>
            <Link to="/login" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Login</Link>
            <Link to="/register" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
