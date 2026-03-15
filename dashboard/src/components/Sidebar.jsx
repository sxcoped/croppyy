import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Map, Scan, Bell, Wheat,
  TrendingUp, Settings, Leaf, CloudSun, Bug,
  LogOut, ChevronDown, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/fields',     icon: Map,             label: 'My Fields' },
  { to: '/health',     icon: TrendingUp,      label: 'Field Health' },
  { to: '/scan',       icon: Scan,            label: 'Scan Crop' },
  { to: '/pest-risk',  icon: Bug,             label: 'Pest Risk' },
  { to: '/weather',    icon: CloudSun,        label: 'Weather' },
  { to: '/alerts',     icon: Bell,            label: 'Alerts', badge: true },
  { to: '/market',     icon: Wheat,           label: 'Market Prices' },
];

export default function Sidebar() {
  const { signOut, displayName, role, user } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const roleLabel = { farmer: '👨‍🌾 Farmer', agronomist: '🔬 Agronomist', admin: '⚙️ Admin' }[role] || role;

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Leaf size={22} />
        </div>
        <div>
          <span className="logo-text">Croppy</span>
          <span className="logo-sub">Precision Ag Platform</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
            {badge && <span className="nav-badge">!</span>}
          </NavLink>
        ))}
      </nav>

      {/* User card + Footer */}
      <div className="sidebar-footer">
        {/* User menu */}
        <div className="user-card" onClick={() => setUserMenuOpen(o => !o)}>
          <div className="user-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">{displayName}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
          <ChevronDown size={14} className={`user-chevron ${userMenuOpen ? 'open' : ''}`} />
        </div>

        {userMenuOpen && (
          <div className="user-menu">
            <div className="user-menu-email">{user?.email}</div>
            <NavLink to="/settings" className="user-menu-item" onClick={() => setUserMenuOpen(false)}>
              <Settings size={14} /> Settings
            </NavLink>
            <button className="user-menu-item danger" onClick={() => { setUserMenuOpen(false); signOut(); }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}

        <div className="sidebar-version">v0.2.0 — SIH 2025</div>
      </div>
    </aside>
  );
}
