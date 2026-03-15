import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';

// Pages
import Landing       from './pages/Landing';
import Login         from './pages/Login';
import Register      from './pages/Register';
import Dashboard     from './pages/Dashboard';
import Fields        from './pages/Fields';
import FieldHealth   from './pages/FieldHealth';
import ScanCrop      from './pages/ScanCrop';
import PestRisk      from './pages/PestRisk';
import Weather       from './pages/Weather';
import Alerts        from './pages/Alerts';
import MarketPrices  from './pages/MarketPrices';

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
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"          element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/fields"    element={<ProtectedRoute><Fields /></ProtectedRoute>} />
          <Route path="/health"    element={<ProtectedRoute><FieldHealth /></ProtectedRoute>} />
          <Route path="/scan"      element={<ProtectedRoute><ScanCrop /></ProtectedRoute>} />
          <Route path="/pest-risk" element={<ProtectedRoute><PestRisk /></ProtectedRoute>} />
          <Route path="/weather"   element={<ProtectedRoute><Weather /></ProtectedRoute>} />
          <Route path="/alerts"    element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="/market"    element={<ProtectedRoute><MarketPrices /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ── Root router ──────────────────────────────────────────────────────
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public pages */}
      <Route path="/landing"  element={<Landing />} />
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />

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
              background: '#161f1b',
              color: '#e8f5e9',
              border: '1px solid rgba(76,175,80,0.25)',
              borderRadius: '10px',
              fontSize: '0.88rem',
            },
            success: { iconTheme: { primary: '#66bb6a', secondary: '#161f1b' } },
            error:   { iconTheme: { primary: '#ef5350', secondary: '#161f1b' } },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
