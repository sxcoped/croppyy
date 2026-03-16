import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, ArrowRight, CheckCircle2, Star } from 'lucide-react';
import { Gallery4 } from '@/components/ui/gallery4';

const GALLERY = [
  'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c18?w=600&auto=format&fit=crop&q=80',
];



const s = {
  page:       { background: '#fff', color: '#111', fontFamily: "'Inter', system-ui, sans-serif" },
  nav:        { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(67,160,71,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1b5e20' },
  navInner:   { maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo:       { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon:   { width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#43a047,#2e7d32)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge:      { fontSize: 10, padding: '2px 8px', background: '#1b5e20', color: '#2e7d32', borderRadius: 99, fontWeight: 700 },
  signIn:     { padding: '7px 16px', fontSize: 14, fontWeight: 600, color: '#555', textDecoration: 'none', borderRadius: 8 },
  getStarted: { padding: '7px 18px', fontSize: 14, fontWeight: 700, color: '#fff', background: '#43a047', borderRadius: 8, textDecoration: 'none' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '13px 26px', background: '#43a047', color: '#fff', fontSize: 15, fontWeight: 700, borderRadius: 12, textDecoration: 'none', boxShadow: '0 6px 20px rgba(67,160,71,0.35)' },
  btnOutline: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '13px 26px', border: '1.5px solid rgba(67,160,71,0.35)', color: '#fff', fontSize: 15, fontWeight: 600, borderRadius: 12, textDecoration: 'none', background: 'transparent' },
};

export default function Landing() {
  useEffect(() => {
    const prev = document.body.style.cssText;
    document.body.style.background = '#fff';
    document.body.style.color = '#111';
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

      {/* HERO */}
      <div style={{ marginTop: 60, position: 'relative', width: '100%', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        <video
          autoPlay loop muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center', color: '#fff' }}>
          <h1 style={{ fontSize: 'clamp(32px,5vw,64px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', margin: '0 0 16px', maxWidth: 700 }}>
            Your crops,<br /><span style={{ color: '#69f0ae' }}>watched from space</span>
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(67,160,71,0.85)', lineHeight: 1.65, margin: 0, maxWidth: 600 }}>
            AI-powered crop health monitoring for Indian farmers. Detect disease, track vegetation, forecast stress — before damage is done.
          </p>
        </div>
      </div>

      {/* CTA + STATS combined */}
      <section style={{ background: '#fff', borderTop: '1px solid #1b5e20' }}>
        {/* CTA row */}
        <div style={{ background: '#1b5e20', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <Link to="/register" style={{ ...s.btnPrimary, padding: '14px 30px', fontSize: 15 }}>
              Start Monitoring Free <ArrowRight size={16} />
            </Link>
            <Link to="/login" style={{ ...s.btnOutline, padding: '14px 28px', fontSize: 15 }}>
              Sign In
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(67,160,71,0.45)', margin: 0, letterSpacing: '0.4px' }}>
            Free for farmers &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; SIH 25099
          </p>
        </div>

        {/* STATS row */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '52px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { v: '38',    l: 'Disease Classes'   },
            { v: '8',     l: 'Vegetation Indices' },
            { v: '14',    l: 'Crop Varieties'     },
            { v: '5-day', l: 'Revisit Cycle'      },
          ].map(({ v, l }, i, arr) => (
            <div key={l} style={{
              textAlign: 'center',
              borderRight: i < arr.length - 1 ? '1px solid #1b5e20' : 'none',
              padding: '0 16px',
            }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#2e7d32', lineHeight: 1, letterSpacing: '-1px' }}>{v}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES — Gallery4 carousel */}
      <Gallery4
        title="Everything your farm needs"
        description="From satellite imagery to AI inference — the full precision agriculture stack, built for Indian farmers."
      />

      {/* HOW IT WORKS */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#43a047', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 10 }}>Process</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#111', margin: 0 }}>How Croppy works</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 40 }}>
            {[
              { n: 1, t: 'Register your field', d: 'Drop a pin, name your plot, pick your crop. Sentinel-2 data streams automatically.' },
              { n: 2, t: 'Get AI analysis',     d: 'Satellite indices + disease scan + pest risk — computed in seconds.' },
              { n: 3, t: 'Act on alerts',       d: 'Get notified before damage happens. Download PDF reports. Check mandi rates.' },
            ].map(({ n, t, d }) => (
              <div key={n}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#43a047', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginBottom: 16, boxShadow: '0 4px 14px rgba(67,160,71,0.3)' }}>{n}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111', marginBottom: 8 }}>{t}</div>
                <div style={{ fontSize: 14, color: '#777', lineHeight: 1.65 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section style={{ background: '#f9fafb', padding: '96px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#111', margin: '0 0 12px' }}>Built for Indian agriculture</h2>
            <p style={{ fontSize: 16, color: '#888', margin: 0 }}>Real satellite data. Real crop varieties. Real mandi prices.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {GALLERY.map((src, i) => (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '4/3', background: '#e0e0e0' }}>
                <img
                  src={src} alt="" loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.35s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: '#111', textAlign: 'center', marginBottom: 48 }}>Trusted by farmers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { n: 'Arjun Sharma',  r: 'Wheat, Punjab',       q: 'Caught a rust infection 3 weeks early. Saved my entire rabi crop.' },
              { n: 'Dr. Priya Nair',r: 'Agronomist, Kerala',  q: 'Satellite indices match my ground-truth surveys. Remarkable.' },
              { n: 'Rajesh Patel', r: 'Cotton, Gujarat',      q: 'Market alerts helped me hold 8 more days — ₹40k extra profit.' },
            ].map(({ n, r, q }) => (
              <div key={n} style={{ background: '#f9fafb', borderRadius: 16, padding: 24, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {[1,2,3,4,5].map(i => <Star key={i} size={13} fill="#ffc107" color="#ffc107" />)}
                </div>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 16 }}>"{q}"</p>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{n}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>{r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', padding: '96px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,5vw,44px)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 14 }}>
            Start protecting your crops today
          </h2>
          <p style={{ fontSize: 17, color: '#c8e6c9', marginBottom: 32 }}>
            Join farmers across India using satellite intelligence to grow smarter.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
            <Link to="/register" style={{ ...s.btnPrimary, background: '#fff', color: '#2e7d32', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              Create Free Account <ArrowRight size={16} />
            </Link>
            <Link to="/login" style={s.btnOutline}>Sign In</Link>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', color: '#c8e6c9', fontSize: 13 }}>
            {['Free for farmers', 'No credit card', 'Made in India 🇮🇳'].map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={14} color="#a5d6a7" /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '28px 24px' }}>
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
