import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { SquarePen } from 'lucide-react';
import SearchPage from './pages/SearchPage';
import ForYouPage from './pages/ForYouPage';
import TrackerPage from './pages/TrackerPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import NewsPage from './pages/NewsPage';
import LoginPage from './pages/LoginPage';
import PersonalizationSidebar from './components/PersonalizationSidebar';
import SmartAlertsBell from './components/SmartAlertsBell';
import InstallPrompt from './components/InstallPrompt';
import { useAuth } from './contexts/AuthContext';
import { hasLocalGuestData, migrateGuestDataToSupabase, isMigrationDone } from './utils/migration';
import { getSessions, generateId, getJobMode, saveJobMode, getSeenJobLinks, addSeenJobLinks, addNotification, getFollowedLastChecked, saveFollowedLastChecked, hasAskedNotificationPermission, getIsGuest, setGuestMode } from './utils/storage';
import { useUserData } from './utils/useUserData';

export default function App() {
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { getPersonalization, savePersonalization, getSettings, getSearchHistory, getFollowedCompanies } = useUserData();
  const location = useLocation();

  const [isGuest, setIsGuest] = useState(() => getIsGuest());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [personalization, setPersonalization] = useState(null);
  const [jobMode, setJobMode] = useState('job');
  
  const [unseenFollowedCount, setUnseenFollowedCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatScrolled, setIsChatScrolled] = useState(false);

  // Initialize data asynchronously
  useEffect(() => {
    let isMounted = true;
    getPersonalization().then(p => {
      if (isMounted && p) setPersonalization(p);
    });
    
    const savedMode = getJobMode();
    if (!savedMode || savedMode === 'job') {
      getSettings().then(s => {
        if (isMounted && s) setJobMode(s.defaultMode || 'job');
      });
    } else {
      setJobMode(savedMode);
    }
    
    return () => { isMounted = false; };
  }, [getPersonalization, getSettings]);

  // Handle OAuth redirect return — migrate guest data if needed
  useEffect(() => {
    if (isAuthenticated && user && !isMigrationDone(user.id)) {
      if (hasLocalGuestData()) {
        migrateGuestDataToSupabase(user.id)
          .then(() => {
            console.log('Guest data migrated to Supabase on OAuth return');
          })
          .catch((err) => {
            console.error('Migration failed on OAuth return:', err);
            // Data is preserved in localStorage — not lost
          });
      }
    }
  }, [isAuthenticated, user]);

  // Auto-login when authenticated via Supabase (e.g. OAuth redirect)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      setIsGuest(true); // allow into app
      setGuestMode(true); // persist so reloads don't bounce back to login
    }
  }, [isAuthenticated]);

  // Detect mobile keyboard open/close
  useEffect(() => {
    if (!window.visualViewport) return;
    
    function handleResize() {
      // If visual viewport shrinks significantly compared to window innerHeight, keyboard is likely open
      const isKeyboardOpen = window.visualViewport.height < window.innerHeight - 100;
      if (isKeyboardOpen) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    }
    
    window.visualViewport.addEventListener('resize', handleResize);
    // Initial check
    handleResize();
    
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  // Listen for chat scroll events to shrink the Jobsy pill
  useEffect(() => {
    function handleChatScroll(e) {
      setIsChatScrolled(e.detail.scrollTop > 40);
    }
    window.addEventListener('chatScroll', handleChatScroll);
    return () => window.removeEventListener('chatScroll', handleChatScroll);
  }, []);
  
  // Set initial session to the most recent one, or generate a new ID
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const sessions = getSessions();
    return sessions.length > 0 ? sessions[0].id : generateId();
  });

  const navigate = useNavigate();

  function handleSavePersonalization(data) {
    savePersonalization(data);
    setPersonalization(data);
    setIsSidebarOpen(false);
  }

  function handleNewChat() {
    setActiveSessionId(generateId());
    setIsSidebarOpen(false); // close sidebar if open
    navigate('/'); // navigate to chat view
  }

  function handleToggleJobMode() {
    const newMode = jobMode === 'job' ? 'career_chat' : 'job';
    setJobMode(newMode);
    saveJobMode(newMode);
  }

  // Smart Alerts: cross-reference new jobs against search history
  const checkForSmartAlerts = useCallback(async (newJobs) => {
    if (!newJobs || newJobs.length === 0) return;
    
    const searchHistory = await getSearchHistory();
    if (!searchHistory || searchHistory.length === 0) return;

    const seenLinks = new Set(getSeenJobLinks());
    const newLinks = [];

    for (const job of newJobs) {
      // Skip already-seen jobs
      if (seenLinks.has(job.applyLink)) continue;
      newLinks.push(job.applyLink);

      // Check if this job matches any search history entry
      for (const entry of searchHistory) {
        const companyMatch = entry.company && job.company && 
          job.company.toLowerCase().includes(entry.company.toLowerCase());
        const roleMatch = entry.role && job.title &&
          job.title.toLowerCase().includes(entry.role.toLowerCase().split(' ')[0]);

        if (companyMatch || roleMatch) {
          const timeAgo = job.postedHoursAgo ? `${job.postedHoursAgo}h ago` : 'recently';
          const message = companyMatch
            ? `${job.company} just posted a new ${job.title} role — ${timeAgo}`
            : `New ${job.title} role at ${job.company} matches your search — ${timeAgo}`;
          
          addNotification({
            message,
            company: job.company,
            role: job.title,
            jobLink: job.applyLink,
          });

          // Browser notification (if permitted)
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Jobsy — New Match', { body: message, icon: '/favicon.ico' });
            } catch (e) {
              // Service worker not available, skip
            }
          }
          break; // One notification per job
        }
      }
    }

    // Mark all new jobs as seen
    if (newLinks.length > 0) {
      addSeenJobLinks(newLinks);
    }
  }, [getSearchHistory]);

    // Background polling for smart alerts (reuse For You fetch mechanism)
  useEffect(() => {
    // Run every 30 minutes
    const interval = setInterval(async () => {
      // 1. Smart Alerts (For You)
      const p = await getPersonalization();
      const prof = { skills: [] }; // Minimal profile for fetch if needed
      
      // Only poll if they've set up some personalization
      if (p && (p.profession || p.degree || p.country)) {
        try {
          const res = await fetch('/api/for-you', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personalization: p, profile: prof }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.jobs && result.jobs.length > 0) {
              checkForSmartAlerts(result.jobs);
            }
          }
        } catch (err) {
          // Ignore polling errors
        }
      }

      // 2. Followed Companies
      const followed = await getFollowedCompanies();
      if (followed && followed.length > 0) {
        try {
          const timestamps = getFollowedLastChecked();
          const res = await fetch('/api/check-followed-companies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followedCompanies: followed.map(f => f.company), lastCheckedTimestamps: timestamps })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.updatedTimestamps) {
              saveFollowedLastChecked({ ...timestamps, ...data.updatedTimestamps });
            }
            if (data.newPostings && data.newPostings.length > 0) {
              setUnseenFollowedCount(prev => prev + data.newPostings.length);
              
              // Push notification if permitted
              if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted' && hasAskedNotificationPermission()) {
                const latest = data.newPostings[0];
                try {
                  new Notification(`${latest.company} posted a new role`, { body: `${latest.title} — posted recently`, icon: '/favicon.ico' });
                } catch (e) {}
              }
            }
          }
        } catch (err) {
          // Ignore polling errors
        }
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkForSmartAlerts]);

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center">
            <img src="/jobsy-logo.png" alt="Jobsy" className="w-full h-full object-contain animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Show login page if not guest AND not authenticated
  if (!isGuest && !isAuthenticated) {
    return <LoginPage onLogin={() => setIsGuest(true)} />;
  }

  function handleLogout() {
    // If authenticated with Supabase, sign out
    if (isAuthenticated) {
      signOut();
    }
    // Clear the guest flag to show login page
    // Important: do NOT clear localStorage guest data on logout
    setGuestMode(false);
    setIsGuest(false);
    navigate('/');
  }

  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden bg-[var(--color-bg)]">
      
      {/* Mobile Floating Pills (replaces header bar) */}
      <div className="lg:hidden">
        {/* Left pill: Jobsy logo + name — tapping opens sidebar */}
        <div
          className="fixed top-3 left-3 z-[60] pointer-events-auto transition-all duration-300 ease-in-out"
          style={{
            transform: isSidebarOpen ? 'translateX(calc(min(85vw, 320px) - 3rem - 12px))' : 'translateX(0)'
          }}
        >
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-2 rounded-full border-0 cursor-pointer bg-[var(--color-surface)]/80 backdrop-blur-xl shadow-sm border border-[var(--color-border)] transition-all duration-300"
            style={{
              WebkitBackdropFilter: 'blur(16px)',
              paddingLeft: '6px',
              paddingRight: isChatScrolled && !isSidebarOpen ? '6px' : '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
            }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/jobsy-logo.png" alt="Jobsy" className="w-full h-full object-contain" />
            </div>
            <span
              className="text-[var(--color-text-primary)] font-light text-sm whitespace-nowrap overflow-hidden transition-all duration-300"
              style={{
                maxWidth: (isChatScrolled || isSidebarOpen) ? '0px' : '60px',
                opacity: (isChatScrolled || isSidebarOpen) ? 0 : 1,
                marginRight: (isChatScrolled || isSidebarOpen) ? '0px' : undefined,
              }}
            >
              Jobsy
            </span>
          </button>
        </div>

        {/* Right pill: bell + new chat */}
        <div
          className={`fixed top-3 right-3 z-[60] pointer-events-auto transition-opacity duration-200 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <div
            className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-[var(--color-surface)]/80 backdrop-blur-xl shadow-sm border border-[var(--color-border)]"
            style={{ WebkitBackdropFilter: 'blur(16px)' }}
          >
            <SmartAlertsBell />
            {location.pathname === '/' && (
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-full border-0 bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-default cursor-pointer"
              >
                <SquarePen size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Main layout wrapper */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <PersonalizationSidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          data={personalization}
          onSave={handleSavePersonalization}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => { setActiveSessionId(id); setIsSidebarOpen(false); navigate('/'); }}
          onNewChat={handleNewChat}
          jobMode={jobMode}
          onToggleJobMode={handleToggleJobMode}
          unseenFollowedCount={unseenFollowedCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Route Content */}
        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route 
              path="/" 
              element={
                <SearchPage 
                  personalization={personalization} 
                  activeSessionId={activeSessionId}
                  jobMode={jobMode}
                />
              } 
            />
            <Route 
              path="/foryou" 
              element={
                <ForYouPage 
                  personalization={personalization} 
                  onNewJobs={checkForSmartAlerts} 
                  unseenFollowedCount={unseenFollowedCount}
                  clearUnseenFollowed={() => setUnseenFollowedCount(0)}
                />
              } 
            />
            <Route path="/tracker" element={<TrackerPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route 
              path="/profile" 
              element={
                <ProfilePage 
                  personalization={personalization}
                  onSavePersonalization={handleSavePersonalization}
                />
              } 
            />
            <Route 
              path="/settings" 
              element={
                <SettingsPage onSavePersonalization={handleSavePersonalization} onLogout={handleLogout} />
              } 
            />
          </Routes>
        </main>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
