import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import { Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase';

// Pages
import Landing       from './pages/Landing';
import Login         from './pages/Login';
import Register      from './pages/Register';
import Onboarding    from './pages/Onboarding';
import Dashboard     from './pages/Dashboard';
import Fields        from './pages/Fields';
import FieldHealth   from './pages/FieldHealth';
import ScanCrop      from './pages/ScanCrop';
import PestRisk      from './pages/PestRisk';
import Weather       from './pages/Weather';
import Alerts        from './pages/Alerts';
import MarketPrices  from './pages/MarketPrices';
import Advisory      from './pages/Advisory';
import Reports       from './pages/Reports';
import Sensors       from './pages/Sensors';
import Analysis      from './pages/Analysis';

import './index.css';

// ── Protected Route ──────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-overlay" style={{ height: '100vh' }}>
        <div className="spinner" />
        <p>Loading Croppy…</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// ── Dashboard shell (sidebar + routes) ──────────────────────────────
function AppShell() {
  const isMobile = window.innerWidth < 768;
  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#f2f7f4',
    }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ padding: '24px 32px', minHeight: '100%' }}>
        <Routes>
          <Route path="/"          element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/fields"    element={<ProtectedRoute><Fields /></ProtectedRoute>} />
          <Route path="/health"    element={<ProtectedRoute><FieldHealth /></ProtectedRoute>} />
          <Route path="/scan"      element={<ProtectedRoute><ScanCrop /></ProtectedRoute>} />
          <Route path="/pest-risk" element={<ProtectedRoute><PestRisk /></ProtectedRoute>} />
          <Route path="/weather"   element={<ProtectedRoute><Weather /></ProtectedRoute>} />
          <Route path="/alerts"    element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="/market"    element={<ProtectedRoute><MarketPrices /></ProtectedRoute>} />
          <Route path="/advisory"  element={<ProtectedRoute><Advisory /></ProtectedRoute>} />
          <Route path="/reports"   element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/sensors"   element={<ProtectedRoute><Sensors /></ProtectedRoute>} />
          <Route path="/analysis"  element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </main>
    </div>
  );
}


// Redirects to `/onboard` if user has no fields, otherwise to `from` (or /)
function LoginRoute() {
  const { isAuthenticated, loading, user, isDemo } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(false);
  const [redirect, setRedirect] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || isDemo) return;
    setChecking(true);
    supabase
      .from('fields')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        setRedirect(count === 0 ? '/onboard' : (location.state?.from?.pathname || '/'));
        setChecking(false);
      })
      .catch(() => {
        setRedirect(location.state?.from?.pathname || '/');
        setChecking(false);
      });
  }, [isAuthenticated, isDemo]);

  if (loading || checking) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader size={32} className="spin" style={{ color: 'var(--green-400)' }} />
    </div>
  );
  if (isAuthenticated) {
    if (redirect) return <Navigate to={redirect} replace />;
    return null; // waiting for field check
  }
  return <Login />;
}

function RegisterRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Register />;
}

// ── Root router ──────────────────────────────────────────────────────
function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  // Don't flash the landing page while session is being restored
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <Loader size={32} className="spin" style={{ color: 'var(--green-400)' }} />
      <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Loading Croppy…</p>
    </div>
  );

  return (
    <Routes>
      {/* Public pages */}
      <Route path="/landing"   element={<Landing />} />
      <Route path="/login"     element={<LoginRoute />} />
      <Route path="/register"  element={<RegisterRoute />} />
      <Route path="/onboard"   element={isAuthenticated ? <Onboarding /> : <Navigate to="/register" replace />} />

      {/* Root: landing for guests, dashboard for signed-in users */}
      <Route
        path="/*"
        element={isAuthenticated ? <AppShell /> : <Landing />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#1b5e20',
              border: '1px solid rgba(67,160,71,0.25)',
              borderRadius: '10px',
              fontSize: '0.88rem',
            },
            success: { iconTheme: { primary: '#66bb6a', secondary: '#ffffff' } },
            error:   { iconTheme: { primary: '#ef5350', secondary: '#ffffff' } },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
