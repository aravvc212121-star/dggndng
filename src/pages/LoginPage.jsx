import { useState } from 'react';
import { Briefcase, Loader, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { setGuestMode } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';
import { hasLocalGuestData, migrateGuestDataToSupabase } from '../utils/migration';

export default function LoginPage({ onLogin }) {
  const { signIn, signUp, signInWithGoogle, authError, clearAuthError } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null); // null | 'migrating' | 'done' | 'error'
  const [migrationError, setMigrationError] = useState(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  const handleGuestLogin = () => {
    setGuestMode(true);
    if (onLogin) onLogin();
  };

  async function runMigrationIfNeeded(userId) {
    if (hasLocalGuestData()) {
      setMigrationStatus('migrating');
      try {
        await migrateGuestDataToSupabase(userId);
        setMigrationStatus('done');
      } catch (err) {
        setMigrationStatus('error');
        setMigrationError(err.message);
        // Don't block login — they can still use the app, migration can be retried
        console.error('Migration failed:', err);
      }
    }
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setLocalError(null);
    clearAuthError();

    try {
      if (mode === 'signup') {
        if (!username || username.trim().length < 3) {
          setLocalError('Username must be at least 3 characters.');
          setLoading(false);
          return;
        }

        // Check username uniqueness
        const res = await fetch(`/api/check-username?username=${encodeURIComponent(username.trim())}`);
        if (!res.ok) {
          setLocalError('Failed to verify username. Please try again.');
          setLoading(false);
          return;
        }
        const { available } = await res.json();
        if (!available) {
          setLocalError('This username is already taken.');
          setLoading(false);
          return;
        }

        const { data, error } = await signUp(email, password);
        if (error) {
          setLocalError(error.message);
          setLoading(false);
          return;
        }
        // Supabase may require email confirmation
        if (data?.user && !data.session) {
          setConfirmationSent(true);
          setLoading(false);
          return;
        }
        // If auto-confirmed (e.g. in dev), proceed
        if (data?.user) {
          // Attempt to update profile with username immediately
          await supabase.from('profiles').upsert({ id: data.user.id, username: username.trim(), updated_at: new Date().toISOString() });
          
          await runMigrationIfNeeded(data.user.id);
          setGuestMode(false);
          if (onLogin) onLogin();
        }
      } else {
        const { data, error } = await signIn(email, password);
        if (error) {
          setLocalError(error.message);
          setLoading(false);
          return;
        }
        if (data?.user) {
          await runMigrationIfNeeded(data.user.id);
          setGuestMode(false);
          if (onLogin) onLogin();
        }
      }
    } catch (err) {
      setLocalError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setLocalError(null);
    clearAuthError();
    // OAuth will redirect — migration happens on return (handled in App.jsx)
    await signInWithGoogle();
  }

  const errorMessage = localError || authError;

  if (confirmationSent) {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-[var(--color-bg)]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-sm mx-auto w-full">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 flex items-center justify-center mb-3">
              <img src="/jobsy-logo.png" alt="Jobsy Logo" className="w-full h-full object-contain" />
            </div>
            <Mail size={32} className="text-[var(--color-accent)] mb-3" />
            <h1 className="text-xl font-bold text-[var(--color-text-primary)] m-0 mb-2">Check your email</h1>
            <p className="text-sm text-[var(--color-text-secondary)] m-0 text-center leading-relaxed">
              We've sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account, then come back and log in.
            </p>
          </div>
          <button
            onClick={() => { setConfirmationSent(false); setMode('login'); }}
            className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] font-semibold text-[15px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[var(--color-bg)]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-sm mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center mb-3">
            <img src="/jobsy-logo.png" alt="Jobsy Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] m-0 mb-1">Jobsy</h1>
          <p className="text-sm text-[var(--color-text-secondary)] m-0">Find your next career move</p>
        </div>

        {/* Migration Status Banner */}
        {migrationStatus === 'migrating' && (
          <div className="w-full mb-4 p-3 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 flex items-center gap-2">
            <Loader size={14} className="animate-spin text-[var(--color-accent)]" />
            <span className="text-xs text-[var(--color-accent)]">Migrating your guest data to your account...</span>
          </div>
        )}
        {migrationStatus === 'error' && (
          <div className="w-full mb-4 p-3 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 flex items-start gap-2">
            <AlertCircle size={14} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
            <span className="text-xs text-[var(--color-danger)]">{migrationError}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && migrationStatus !== 'error' && (
          <div className="w-full mb-4 p-3 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 flex items-start gap-2">
            <AlertCircle size={14} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
            <span className="text-xs text-[var(--color-danger)]">{errorMessage}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleEmailAuth} className="w-full space-y-3 mb-4">
          {mode === 'signup' && (
            <input 
              type="text" 
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!supabaseReady || loading}
              className={`w-full h-11 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-default focus:border-[var(--color-accent)] ${!supabaseReady ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
          )}
          <input 
            type="email" 
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!supabaseReady || loading}
            className={`w-full h-11 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-default focus:border-[var(--color-accent)] ${!supabaseReady ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!supabaseReady || loading}
              className={`w-full h-11 px-4 pr-11 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none transition-default focus:border-[var(--color-accent)] ${!supabaseReady ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {supabaseReady && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] bg-transparent border-0 cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
        </form>
        
        <button 
          onClick={handleEmailAuth}
          disabled={!supabaseReady || loading}
          className={`w-full h-11 bg-[var(--color-accent)] text-white rounded-[12px] font-semibold text-[15px] mb-6 border-0 flex items-center justify-center gap-2 transition-default ${!supabaseReady || loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
        >
          {loading ? (
            <>
              <Loader size={16} className="animate-spin" />
              {mode === 'signup' ? 'Creating account...' : 'Logging in...'}
            </>
          ) : (
            mode === 'signup' ? 'Create account' : 'Log in'
          )}
        </button>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 mb-6">
          <div className="flex-1 h-[1px] bg-[var(--color-border)]"></div>
          <span className="text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-wider font-medium">or continue with</span>
          <div className="flex-1 h-[1px] bg-[var(--color-border)]"></div>
        </div>

        {/* Social Buttons */}
        <div className="w-full flex gap-3 mb-6">
          <button 
            onClick={handleGoogleAuth}
            disabled={!supabaseReady || loading}
            className={`flex-1 h-11 flex items-center justify-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] font-medium text-[14px] text-[var(--color-text-primary)] transition-default ${!supabaseReady || loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--color-surface-alt)] hover:border-[var(--color-text-tertiary)]'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button 
            disabled
            className="flex-1 h-11 flex items-center justify-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] font-medium text-[14px] text-[var(--color-text-primary)] opacity-60 cursor-not-allowed"
            title="LinkedIn OAuth coming soon"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            LinkedIn
          </button>
        </div>

        {/* Guest Action (Functional) */}
        <button 
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] font-semibold text-[15px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] hover:border-[var(--color-text-tertiary)] transition-default cursor-pointer mb-2"
        >
          <Briefcase size={16} className="text-[var(--color-text-secondary)]" />
          Continue as guest
        </button>
        <p className="text-[11px] text-[var(--color-text-tertiary)] text-center leading-relaxed max-w-[280px]">
          Guest mode stores your data only in this browser. Sign in to sync across devices.
        </p>
      </div>

      {/* Footer */}
      <div className="shrink-0 pb-8 pt-4">
        <p className="text-[13px] text-center text-[var(--color-text-secondary)] m-0">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setLocalError(null); clearAuthError(); }}
                className="text-[var(--color-accent)] font-medium bg-transparent border-0 cursor-pointer p-0 underline-offset-2 hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setLocalError(null); clearAuthError(); }}
                className="text-[var(--color-accent)] font-medium bg-transparent border-0 cursor-pointer p-0 underline-offset-2 hover:underline"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
