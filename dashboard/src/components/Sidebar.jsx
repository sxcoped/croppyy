import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Map, Scan, Bell, Wheat,
  TrendingUp, Settings, Leaf, CloudSun, Bug,
  LogOut, ChevronDown, Zap, FileText, Menu, X, Cpu, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const NAV_ITEMS = [
  { href: '/',           icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/fields',     icon: Map,             label: 'My Fields'     },
  { href: '/health',     icon: TrendingUp,      label: 'Field Health'  },
  { href: '/scan',       icon: Scan,            label: 'Scan Crop'     },
  { href: '/pest-risk',  icon: Bug,             label: 'Pest Risk'     },
  { href: '/weather',    icon: CloudSun,        label: 'Weather'       },
  { href: '/advisory',   icon: Zap,             label: 'Advisory'      },
  { href: '/alerts',     icon: Bell,            label: 'Alerts', badge: true },
  { href: '/market',     icon: Wheat,           label: 'Market Prices' },
  { href: '/sensors',    icon: Cpu,             label: 'Sensor Input'  },
  { href: '/reports',    icon: FileText,        label: 'Reports'       },
  { href: '/analysis',   icon: Activity,        label: 'Analysis'      },
];

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = {
  sidebar: {
    background: '#ffffff',
    borderRight: '1px solid rgba(67,160,71,0.15)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    flexShrink: 0,
    overflow: 'hidden',
    transition: 'width 220ms ease-in-out',
    padding: '16px 8px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 8px 12px',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(67,160,71,0.08)',
    marginBottom: 8,
  },
  logoIcon: {
    flexShrink: 0,
    width: 36, height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #43a047, #2e7d32)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  divider: {
    height: 1, background: 'rgba(67,160,71,0.08)',
    margin: '4px 8px 8px',
  },
  userCard: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTop: '1px solid rgba(67,160,71,0.1)',
  },
};

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ href, icon: Icon, label, badge, expanded }) {
  const location = useLocation();
  const isActive = href === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(href);

  return (
    <NavLink
      to={href}
      style={({ isActive: a }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 10px 10px 14px',
        borderRadius: 10,
        textDecoration: 'none',
        position: 'relative',
        color: a ? '#2e7d32' : '#6b8a72',
        background: a ? 'rgba(67,160,71,0.1)' : 'transparent',
        fontWeight: a ? 600 : 400,
        transition: 'all 150ms ease',
        marginBottom: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      })}
      onMouseEnter={e => {
        if (!e.currentTarget.style.background.includes('0.1'))
          e.currentTarget.style.background = 'rgba(67,160,71,0.05)';
        e.currentTarget.style.color = '#1b5e20';
      }}
      onMouseLeave={e => {
        const active = href === '/'
          ? window.location.pathname === '/'
          : window.location.pathname.startsWith(href);
        e.currentTarget.style.background = active ? 'rgba(67,160,71,0.1)' : 'transparent';
        e.currentTarget.style.color = active ? '#2e7d32' : '#6b8a72';
      }}
    >
      {({ isActive: a }) => (
        <>
          {a && (
            <span style={{
              position: 'absolute', left: 0, top: 6, bottom: 6,
              width: 3, borderRadius: '0 2px 2px 0',
              background: '#43a047',
            }} />
          )}
        <Icon size={18} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '0.85rem',
            opacity: expanded ? 1 : 0,
            transition: 'opacity 150ms ease',
            flex: 1,
          }}>
            {label}
          </span>
          {badge && expanded && (
            <span style={{
              background: '#ef5350', color: '#fff',
              fontSize: 9, fontWeight: 700,
              borderRadius: 99, padding: '1px 5px',
              marginLeft: 'auto',
            }}>!</span>
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Language Switcher ─────────────────────────────────────────────────────────
function LanguageSwitcher({ expanded }) {
  const { i18n } = useTranslation();
  
  if (!expanded) return null;

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(67,160,71,0.1)' }}>
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid rgba(67,160,71,0.2)',
          background: '#f2f7f4',
          color: '#1b5e20',
          fontSize: '0.8rem',
          outline: 'none',
          cursor: 'pointer'
        }}
      >
        <option value="en">English</option>
        <option value="hi">हिंदी (Hindi)</option>
        <option value="te">తెలుగు (Telugu)</option>
        <option value="kn">ಕನ್ನಡ (Kannada)</option>
      </select>
    </div>
  );
}

// ── User card ─────────────────────────────────────────────────────────────────
function UserCard({ expanded }) {
  const { signOut, displayName, role, user, isDemo } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { i18n } = useTranslation();

  const roleLabel = {
    farmer: '👨‍🌾 Farmer',
    agronomist: '🔬 Agronomist',
    admin: '⚙️ Admin',
  }[role] || role;

  return (
    <div style={S.userCard}>
      {isDemo && expanded && (
        <div style={{
          margin: '0 4px 8px', padding: '6px 12px',
          borderRadius: 8,
          background: 'rgba(255,179,0,0.1)',
          border: '1px solid rgba(255,179,0,0.25)',
          color: '#ffb300', fontSize: '0.72rem',
          textAlign: 'center', fontWeight: 600,
        }}>
          Demo Mode
        </div>
      )}

      <button
        onClick={() => setMenuOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 10, border: 'none',
          background: 'transparent', cursor: 'pointer',
          transition: 'background 150ms',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(67,160,71,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #43a047, #2e7d32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: '0.85rem',
        }}>
          {displayName?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        {expanded && (
          <>
            <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ color: '#1b5e20', fontSize: '0.82rem', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ color: '#6b8a72', fontSize: '0.65rem' }}>{roleLabel}</div>
            </div>
            <ChevronDown size={12} style={{
              color: '#6b8a72', flexShrink: 0,
              transform: menuOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 200ms',
            }} />
          </>
        )}
      </button>

      {menuOpen && expanded && (
        <div style={{
          margin: '4px 4px 0',
          background: '#ffffff',
          border: '1px solid rgba(67,160,71,0.15)',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ padding: '6px 12px', fontSize: '0.68rem', color: '#6b8a72',
            borderBottom: '1px solid rgba(67,160,71,0.1)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <NavLink
            to="/settings"
            onClick={() => setMenuOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', color: '#4a6650', fontSize: '0.82rem',
              textDecoration: 'none', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#1b5e20'; e.currentTarget.style.background = 'rgba(67,160,71,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a6650'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Settings size={13} /> {i18n.t('settings') || 'Settings'}
          </NavLink>
          <button
            onClick={() => { setMenuOpen(false); signOut(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', border: 'none', background: 'transparent',
              color: '#ef9a9a', fontSize: '0.82rem', cursor: 'pointer',
              transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef5350'; e.currentTarget.style.background = 'rgba(239,83,80,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#ef9a9a'; e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={13} /> {i18n.t('logout') || 'Sign out'}
          </button>
        </div>
      )}

      {expanded && (
        <div style={{ textAlign: 'center', fontSize: '0.6rem',
          color: '#37473a', padding: '8px 0 4px' }}>
          v0.3.0 — SIH 2025
        </div>
      )}
    </div>
  );
}

// ── Desktop sidebar (hover to expand) ─────────────────────────────────────────
function DesktopSidebar() {
  const [expanded, setExpanded] = useState(false);
  const { i18n } = useTranslation();

  return (
    <div
      style={{ ...S.sidebar, width: expanded ? 260 : 64 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <NavLink to="/" style={S.logo}>
        <div style={S.logoIcon}>
          <Leaf size={16} color="#fff" />
        </div>
        <div style={{
          opacity: expanded ? 1 : 0,
          transition: 'opacity 150ms ease',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          <div style={{ color: '#1b5e20', fontWeight: 800, fontSize: '1rem',
            letterSpacing: '-0.3px' }}>Croppy</div>
          <div style={{ color: '#6b8a72', fontSize: '0.58rem',
            textTransform: 'uppercase', letterSpacing: 2 }}>Precision Ag</div>
        </div>
      </NavLink>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.href} {...item} label={i18n.t(item.label.toLowerCase().replace(' ', '_')) || item.label} expanded={expanded} />
        ))}
      </nav>

      <LanguageSwitcher expanded={expanded} />
      <UserCard expanded={expanded} />
    </div>
  );
}

// ── Mobile sidebar (hamburger + drawer) ───────────────────────────────────────
function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();

  return (
    <>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#ffffff', borderBottom: '1px solid rgba(67,160,71,0.15)',
        width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #43a047, #2e7d32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Leaf size={13} color="#fff" />
          </div>
          <span style={{ color: '#1b5e20', fontWeight: 700, fontSize: '0.9rem' }}>
            Croppy
          </span>
        </div>
        <button onClick={() => setOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6b8a72', padding: 4,
        }}>
          <Menu size={20} />
        </button>
      </div>

      {/* Drawer overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: 260, background: '#ffffff',
              borderRight: '1px solid rgba(67,160,71,0.15)',
              display: 'flex', flexDirection: 'column',
              padding: '16px 8px',
              animation: 'slideIn 220ms ease-out',
            }}
          >
            <button
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute', right: 12, top: 12,
                background: 'none', border: 'none',
                color: '#6b8a72', cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>

            <NavLink to="/" style={{ ...S.logo, paddingTop: 4 }} onClick={() => setOpen(false)}>
              <div style={S.logoIcon}><Leaf size={16} color="#fff" /></div>
              <div>
                <div style={{ color: '#1b5e20', fontWeight: 800, fontSize: '1rem' }}>Croppy</div>
                <div style={{ color: '#6b8a72', fontSize: '0.58rem',
                  textTransform: 'uppercase', letterSpacing: 2 }}>Precision Ag</div>
              </div>
            </NavLink>

            <nav style={{ flex: 1, overflowY: 'auto' }} onClick={() => setOpen(false)}>
              {NAV_ITEMS.map(item => (
                <NavItem key={item.href} {...item} label={i18n.t(item.label.toLowerCase().replace(' ', '_')) || item.label} expanded={true} />
              ))}
            </nav>

            <UserCard expanded={true} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return (
      <div style={{ width: '100%', flexShrink: 0 }}>
        <MobileSidebar />
      </div>
    );
  }

  return <DesktopSidebar />;
}
