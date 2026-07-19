import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { deleteAccount } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // supabase user object or null
  const [session, setSession] = useState(null);     // supabase session or null
  const [loading, setLoading] = useState(true);     // true while checking initial session
  const [authError, setAuthError] = useState(null); // last auth error message

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ─── Sign up with email/password ───
  const signUp = useCallback(async (email, password) => {
    if (!isSupabaseConfigured()) {
      setAuthError('Supabase is not configured.');
      return { error: { message: 'Supabase is not configured.' } };
    }
    setAuthError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
      return { error };
    }

    // Create empty profile row for the new user
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        updated_at: new Date().toISOString(),
      });
      await supabase.from('settings').upsert({
        user_id: data.user.id,
      });
    }

    return { data };
  }, []);

  // ─── Sign in with email/password ───
  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured()) {
      setAuthError('Supabase is not configured.');
      return { error: { message: 'Supabase is not configured.' } };
    }
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
      return { error };
    }

    return { data };
  }, []);

  // ─── Sign in with OAuth (Google) ───
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAuthError('Supabase is not configured.');
      return { error: { message: 'Supabase is not configured.' } };
    }
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthError(error.message);
      return { error };
    }

    return { data };
  }, []);

  // ─── Sign out ───
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setAuthError(null);

    // Important: do NOT clear localStorage guest data on logout
    // (per spec — a user might log out and continue as guest)
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
    // State will be updated via onAuthStateChange listener
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // ─── Delete Account ───
  const deleteUserAccount = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setAuthError(null);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
    } catch (err) {
      setAuthError(err.message || 'Failed to delete account');
      throw err;
    }
  }, []);

  const value = {
    user,
    session,
    loading,
    authError,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    deleteUserAccount,
    clearAuthError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
