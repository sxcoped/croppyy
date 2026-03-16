import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const DEMO_USER = {
  id: 'demo-user-id',
  email: 'demo@croppy.in',
};
const DEMO_PROFILE = {
  id: 'demo-user-id',
  name: 'Demo Farmer',
  role: 'farmer',
  language: 'en',
  state: 'Punjab',
  district: 'Ludhiana',
};

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemo,  setIsDemo]  = useState(false);

  // Load current session on mount
  useEffect(() => {
    // Restore demo mode from sessionStorage
    if (sessionStorage.getItem('croppy_demo') === '1') {
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    // Check for OAuth errors in query string or hash (e.g. user denied access)
    const urlParams  = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const oauthError = urlParams.get('error_description') || urlParams.get('error')
                    || hashParams.get('error_description') || hashParams.get('error');
    if (oauthError) {
      toast.error('Google sign-in failed: ' + oauthError);
      window.history.replaceState({}, '', window.location.pathname);
      setLoading(false);
      return;
    }

    // Implicit flow: tokens arrive in the URL hash (#access_token=…).
    // PKCE fallback: code arrives in query string (?code=…).
    // Either way, keep loading=true until onAuthStateChange settles so the
    // app never flashes unauthenticated state during the callback.
    const pendingOAuth = hashParams.has('access_token') || urlParams.has('code');
    let oauthSettled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (sessionStorage.getItem('croppy_demo') === '1') return;

        // Suppress the pre-exchange INITIAL_SESSION null that fires before
        // Supabase has finished processing the OAuth callback tokens.
        if (pendingOAuth && !oauthSettled && event === 'INITIAL_SESSION' && !session) {
          return;
        }
        oauthSettled = true;

        setUser(session?.user ?? null);
        if (session?.user) {
          // Clean OAuth params out of the URL once we have a session
          if (pendingOAuth) window.history.replaceState({}, '', '/');
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Safety net: if the OAuth token detection hangs for > 10 s, give up.
    const timeout = pendingOAuth
      ? setTimeout(() => {
          if (!oauthSettled) {
            toast.error('Sign-in timed out — please try again.');
            setLoading(false);
          }
        }, 10_000)
      : null;

    return () => {
      subscription.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
    } catch {}
    setLoading(false);
  }

  async function signUp({ email, password, name, role = 'farmer', language = 'en', phone, state, district }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    });
    if (error) throw error;

    // Update profile with extra fields
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name, role, language, phone, state, district,
      });
    }
    return data;
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  function enterDemo() {
    sessionStorage.setItem('croppy_demo', '1');
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
    setIsDemo(true);
    toast.success('Demo mode — explore freely!');
  }

  async function signOut() {
    sessionStorage.removeItem('croppy_demo');
    setIsDemo(false);
    if (!isDemo) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    toast.success('Logged out successfully');
  }

  async function updateProfile(updates) {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  }

  // Convenience: get access token for backend API calls
  async function getToken() {
    if (isDemo) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  const value = {
    user,
    profile,
    loading,
    isDemo,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    enterDemo,
    updateProfile,
    getToken,
    displayName: profile?.name || user?.email?.split('@')[0] || 'User',
    role: profile?.role || 'farmer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
