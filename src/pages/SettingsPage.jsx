import { useState, useEffect } from 'react';
import { ChevronLeft, ExternalLink, User, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  setAskedNotificationPermission,
  setGuestMode,
} from '../utils/storage';
import { useUserData } from '../utils/useUserData';

export default function SettingsPage({ onSavePersonalization, onLogout }) {
  const { user, isAuthenticated, deleteUserAccount } = useAuth();
  const { getSettings, saveSettings, getProfile, getApplications, getFollowedCompanies, getSearchHistory, saveProfile, savePersonalization, clearAllData } = useUserData();
  const [settings, setSettings] = useState(null);
  const [profile, setProfile] = useState(null);
  
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // For data clearing checks
  const [hasProfile, setHasProfile] = useState(false);
  const [hasApplications, setHasApplications] = useState(false);
  const [hasFollowedData, setHasFollowedData] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getSettings().then(s => {
      if (isMounted && s) setSettings(s);
    });
    getProfile().then(p => {
      if (isMounted) {
        setHasProfile(!!p?.resumeText);
        setProfile(p);
      }
    });
    getApplications().then(a => {
      if (isMounted) setHasApplications(a?.length > 0);
    });
    getFollowedCompanies().then(fc => {
      getSearchHistory().then(sh => {
        if (isMounted) setHasFollowedData(fc?.length > 0 || sh?.length > 0);
      });
    });
    return () => { isMounted = false; };
  }, [getSettings, getProfile, getApplications, getFollowedCompanies, getSearchHistory]);
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const navigate = useNavigate();
  
  // Confirmation modals
  const [showConfirm, setShowConfirm] = useState(null); // 'profile' | 'tracker' | 'followed' | 'everything' | 'delete_account'
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Update permission state if it changes
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  function handleToggleSetting(key) {
    if (!settings) return;
    if (key === 'defaultMode') {
      const newMode = settings.defaultMode === 'job' ? 'career_chat' : 'job';
      const updated = { ...settings, defaultMode: newMode };
      setSettings(updated);
      saveSettings(updated);
    } else {
      const updated = { ...settings, [key]: !settings[key] };
      setSettings(updated);
      saveSettings(updated);
    }
  }

  async function handleRequestNotificationPermission() {
    if (!('Notification' in window)) return;
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setAskedNotificationPermission();
      
      if (permission === 'granted') {
        new Notification('Jobsy Notifications Enabled', {
          body: "You'll now receive alerts for new job postings",
          icon: '/favicon.svg',
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }

  function getNotificationStatusText() {
    if (!('Notification' in window)) return 'Not supported by browser';
    switch (notificationPermission) {
      case 'granted':
        return 'Enabled';
      case 'denied':
        return 'Blocked by browser';
      default:
        return 'Not enabled';
    }
  }

  function handleClearData(type) {
    setShowConfirm(type);
  }

  async function confirmClearData() {
    const type = showConfirm;
    
    switch (type) {
      case 'profile':
        localStorage.removeItem('jobpilot_profile');
        localStorage.removeItem('jobpilot_personalization');
        // Also clear in-memory state
        saveProfile(null);
        savePersonalization({});
        if (onSavePersonalization) onSavePersonalization({});
        break;
      
      case 'tracker':
        localStorage.removeItem('jobpilot_applications');
        saveApplications([]);
        break;
      
      case 'followed':
        localStorage.removeItem('jobpilot_followed_companies');
        localStorage.removeItem('jobpilot_search_history');
        localStorage.removeItem('jobpilot_followed_last_checked');
        localStorage.removeItem('jobpilot_seen_job_links');
        break;
      
      case 'everything':
        // Clear ALL jobpilot data, both locally and from Supabase cloud
        await clearAllData();
        
        // Reset to defaults in local state
        const defaults = {
          defaultMode: 'job',
          notifyFollowed: true,
          notifySearchHistory: true,
          notifyDailyDigest: false,
        };
        setSettings(defaults);
        setHasProfile(false);
        setHasApplications(false);
        setHasFollowedData(false);
        if (onSavePersonalization) onSavePersonalization({});
        break;

      case 'delete_account':
        setIsDeleting(true);
        try {
          await deleteUserAccount();
          setShowConfirm(null);
          navigate('/'); // Redirect to login or home
        } catch (err) {
          alert('Failed to delete account: ' + err.message);
        } finally {
          setIsDeleting(false);
        }
        return; // Don't call setShowConfirm(null) here because component might unmount
    }
    
    setShowConfirm(null);
  }

  function handleEditProfile() {
    // Navigate to profile page
    navigate('/profile');
  }

  function handleLogout() {
    // Logout is handled by App.jsx (clears Supabase session, preserves local data)
    if (onLogout) onLogout();
  }

  async function handleSaveUsername() {
    setUsernameError('');
    if (!newUsername || newUsername.trim().length < 3) {
      setUsernameError('Username must be at least 3 characters.');
      return;
    }
    const trimmed = newUsername.trim();
    if (trimmed === profile?.username) {
      setIsEditingUsername(false);
      return;
    }
    
    setIsSavingUsername(true);
    try {
      const res = await fetch(`/api/check-username?username=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error();
      const { available } = await res.json();
      if (!available) {
        setUsernameError('This username is already taken.');
        setIsSavingUsername(false);
        return;
      }
      
      const updated = { ...profile, username: trimmed };
      await saveProfile(updated);
      setProfile(updated);
      setIsEditingUsername(false);
    } catch (err) {
      setUsernameError('Failed to verify username. Try again.');
    } finally {
      setIsSavingUsername(false);
    }
  }

  function handleBack() {
    // Navigate back to profile page
    navigate('/profile');
  }

  if (!settings) return null;

  return (
    <>
      <div
        className="h-full overflow-y-auto w-full bg-[var(--color-bg)]"
        onScroll={e => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { scrollTop: e.currentTarget.scrollTop } }))}
      >
        <div className="max-w-2xl mx-auto px-4 pt-16 md:pt-6 pb-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer border-0 bg-transparent text-[var(--color-text-secondary)]"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-base font-medium text-[var(--color-text-primary)] m-0">
                settings
              </h1>
            </div>
          </div>

          {/* Account Info */}
          {isAuthenticated && user && (
            <section className="mb-8">
              <h2 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
                Account
              </h2>
              <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                    <User size={18} className="text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{user.email}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1 mt-0.5">
                      <Shield size={10} />
                      Signed in · data synced to cloud
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section 1: Mode & Personalization */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              Mode & Personalization
            </h2>
            
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
              {/* Username row */}
              {isAuthenticated && profile && (
                <div className="p-4 border-b border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">Username</div>
                      {!isEditingUsername && (
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {profile.username || 'Not set'}
                        </div>
                      )}
                    </div>
                    {!isEditingUsername ? (
                      <button
                        onClick={() => {
                          setNewUsername(profile.username || '');
                          setIsEditingUsername(true);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] cursor-pointer transition-default"
                      >
                        Change
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsEditingUsername(false);
                            setUsernameError('');
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] cursor-pointer transition-default"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveUsername}
                          disabled={isSavingUsername}
                          className={`text-xs px-3 py-1.5 rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:opacity-90 cursor-pointer transition-default ${isSavingUsername ? 'opacity-50' : ''}`}
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditingUsername && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Enter username"
                        disabled={isSavingUsername}
                        className="w-full h-9 px-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                      />
                      {usernameError && <div className="text-xs text-[var(--color-danger)] mt-1">{usernameError}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* Default chat mode */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Default chat mode</div>
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {settings.defaultMode === 'job' ? 'Job mode (show job cards)' : 'Career chat mode (advice only)'}
                  </div>
                </div>
                <button
                  className={`toggle-track ${settings.defaultMode === 'job' ? 'active' : ''}`}
                  onClick={() => handleToggleSetting('defaultMode')}
                  aria-label="Toggle default mode"
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              {/* Edit profile */}
              <button
                onClick={handleEditProfile}
                className="w-full flex items-center justify-between p-4 text-left border-0 bg-transparent hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Edit profile</div>
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Industry, experience, location & resume
                  </div>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-[var(--color-text-secondary)]" />
              </button>
            </div>
          </section>

          {/* Section 2: Notifications */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              Notifications
            </h2>
            
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
              {/* Browser push notifications */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">Browser push notifications</div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      Status: {getNotificationStatusText()}
                    </div>
                  </div>
                </div>
                {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                  <button
                    onClick={handleRequestNotificationPermission}
                    disabled={notificationPermission === 'denied'}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-default ${
                      notificationPermission === 'denied'
                        ? 'border-[var(--color-border)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                        : 'border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white cursor-pointer'
                    }`}
                  >
                    {notificationPermission === 'denied' ? 'Blocked - check browser settings' : 'Enable notifications'}
                  </button>
                )}
              </div>

              {/* Notify me about */}
              <div className="p-4">
                <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Notify me about:</div>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifyFollowed}
                      onChange={() => handleToggleSetting('notifyFollowed')}
                      className="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer"
                    />
                    <div>
                      <div className="text-sm text-[var(--color-text-primary)]">New postings from companies I follow</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifySearchHistory}
                      onChange={() => handleToggleSetting('notifySearchHistory')}
                      className="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer"
                    />
                    <div>
                      <div className="text-sm text-[var(--color-text-primary)]">New postings matching my past searches</div>
                      <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Smart job alerts based on your search history</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifyDailyDigest}
                      onChange={() => handleToggleSetting('notifyDailyDigest')}
                      className="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer"
                    />
                    <div>
                      <div className="text-sm text-[var(--color-text-primary)]">Daily "For You" digest</div>
                      <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">One daily summary notification</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Data & Privacy */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              Data & Privacy
            </h2>
            
            <p className="text-xs text-[var(--color-text-secondary)] mb-4 leading-relaxed">
              {isAuthenticated 
                ? 'Your data is synced to your Supabase account. Using "Clear everything" will permanently delete your data from both this device and your cloud account.'
                : "Your data is stored only in this browser. Clearing it can't be undone, and switching devices won't carry it over. Sign in to sync across devices."}
            </p>

            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
              
              <button
                onClick={() => handleClearData('profile')}
                disabled={!hasProfile}
                className={`w-full flex items-center justify-between p-4 text-left border-0 border-b border-[var(--color-border)] transition-default ${
                  hasProfile
                    ? 'bg-transparent hover:bg-[var(--color-surface-alt)] cursor-pointer'
                    : 'bg-transparent cursor-not-allowed opacity-50'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Clear resume & profile data</div>
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Removes your personalization and uploaded resume
                  </div>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-[var(--color-text-secondary)]" />
              </button>

              <button
                onClick={() => handleClearData('tracker')}
                disabled={!hasApplications}
                className={`w-full flex items-center justify-between p-4 text-left border-0 border-b border-[var(--color-border)] transition-default ${
                  hasApplications
                    ? 'bg-transparent hover:bg-[var(--color-surface-alt)] cursor-pointer'
                    : 'bg-transparent cursor-not-allowed opacity-50'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Clear application tracker</div>
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Removes all tracked job applications
                  </div>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-[var(--color-text-secondary)]" />
              </button>

              <button
                onClick={() => handleClearData('followed')}
                disabled={!hasFollowedData}
                className={`w-full flex items-center justify-between p-4 text-left border-0 border-b border-[var(--color-border)] transition-default ${
                  hasFollowedData
                    ? 'bg-transparent hover:bg-[var(--color-surface-alt)] cursor-pointer'
                    : 'bg-transparent cursor-not-allowed opacity-50'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Clear followed companies & search history</div>
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Removes followed companies and search history
                  </div>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-[var(--color-text-secondary)]" />
              </button>

              <button
                onClick={() => handleClearData('everything')}
                className="w-full flex items-center justify-between p-4 text-left border-0 border-b border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--color-danger)]">Clear everything</div>
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    Resets the entire app to a blank state
                  </div>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-[var(--color-danger)]" />
              </button>
              
              {/* Delete Account (only for authenticated users) */}
              {isAuthenticated && (
                <button 
                  onClick={() => handleClearData('delete_account')}
                  className="w-full flex items-center p-4 bg-[var(--color-surface)] hover:bg-[var(--color-danger)]/5 transition-colors border-t border-[var(--color-border)] group"
                >
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-[var(--color-danger)]">Delete Account</div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Permanently delete your account and all data</div>
                  </div>
                  <ChevronLeft size={16} className="rotate-180 text-[var(--color-danger)]" />
                </button>
              )}
            </div>
          </section>

          {/* Section 4: Google Sheets Sync */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              Google Sheets Sync
            </h2>
            
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
              <div className="p-4">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Application tracker sync
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mb-3">
                  Not yet connected — feature coming soon
                </div>
                <button
                  disabled
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-tertiary)] cursor-not-allowed"
                >
                  Connect Google Sheets
                </button>
              </div>
            </div>
          </section>

          {/* Section 5: About */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">
              About
            </h2>
            
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Version</div>
                <div className="text-sm text-[var(--color-text-primary)]">Jobsy v1.0.0</div>
              </div>

              <a
                href="mailto:feedback@jobsy.app?subject=Jobsy Feedback"
                className="flex items-center justify-between p-4 border-b border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition-default no-underline"
              >
                <div className="text-sm font-medium">Send feedback</div>
                <ExternalLink size={14} className="text-[var(--color-text-secondary)]" />
              </a>

              <div className="p-4">
                <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  JobPilot only helps with job search and career topics
                </div>
              </div>
            </div>
          </section>

          {/* Logout Section */}
          <section className="mt-8 pt-8 border-t border-[var(--color-border)]">
            <button
              onClick={handleLogout}
              className="w-full p-4 rounded-xl border border-[var(--color-danger)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 font-medium transition-default cursor-pointer"
            >
              Log out
            </button>
          </section>

        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] rounded-xl max-w-sm w-full p-6 border border-[var(--color-border)] shadow-lg">
            <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-2">
              {showConfirm === 'everything' 
                ? 'Clear all data?' 
                : showConfirm === 'delete_account'
                  ? 'Delete Account?'
                  : 'Confirm deletion'}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {showConfirm === 'profile' && 'This will delete your resume and profile data. This action cannot be undone.'}
              {showConfirm === 'tracker' && 'This will delete all your tracked job applications. This action cannot be undone.'}
              {showConfirm === 'followed' && 'This will delete your followed companies and search history. This action cannot be undone.'}
              {showConfirm === 'everything' && 'This will reset the entire app to a blank state, removing all your data including resume, applications, followed companies, and chat history. This action cannot be undone.'}
              {showConfirm === 'delete_account' && 'This will permanently delete your account, including all your profile data, applications, and chat history. This action cannot be undone. Are you absolutely sure?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearData}
                className="flex-1 px-4 py-2 rounded-lg border-0 bg-[var(--color-danger)] text-white hover:opacity-90 transition-default cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top and Bottom Fades for Mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-[80px] bg-gradient-to-b from-[var(--color-surface)] from-[20px] to-transparent pointer-events-none z-30" />
    </>
  );
}
