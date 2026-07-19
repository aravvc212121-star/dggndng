import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ChatPanel from '../components/ChatPanel';
import ProfileSummary from '../components/ProfileSummary';
import { getSession, saveSessionMessages, hasAskedNotificationPermission, setAskedNotificationPermission } from '../utils/storage';
import { useUserData } from '../utils/useUserData';
import { useAuth } from '../contexts/AuthContext';
import { chat, saveChatMessage, getChatHistory } from '../utils/api';

export default function SearchPage({ personalization, activeSessionId, jobMode }) {
  const { getProfile, addSearchEntry } = useUserData();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const searchCount = useRef(0);
  const location = useLocation();
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getProfile().then(p => {
      if (isMounted && p) setProfile(p);
    });
    return () => { isMounted = false; };
  }, [getProfile]);

  // Load session messages when activeSessionId changes
  useEffect(() => {
    let isMounted = true;
    async function load() {
      // First check local storage for this specific session
      const localSession = getSession(activeSessionId);
      if (localSession && localSession.messages && localSession.messages.length > 0) {
        if (isMounted) setMessages(localSession.messages);
        return;
      }
      
      // If no local session found AND user is authenticated, try backend history
      if (isAuthenticated) {
        try {
          const history = await getChatHistory();
          if (history && history.length > 0 && isMounted) {
            const parsedHistory = history.map(msg => {
              let content = msg.content;
              let jobs, suggestions, searchFilters;
              if (msg.role === 'assistant') {
                try {
                  const parsed = JSON.parse(msg.content);
                  content = parsed.message || parsed.content;
                  jobs = parsed.jobs;
                  suggestions = parsed.suggestions;
                  searchFilters = parsed.searchFilters;
                } catch (e) {
                  // Was plain text
                }
              }
              return {
                role: msg.role,
                content,
                jobs,
                suggestions,
                searchFilters,
                timestamp: msg.created_at
              };
            });
            setMessages(parsedHistory);
            return;
          }
        } catch (err) {
          // Ignored, will fallback to empty
        }
      }
      
      // New session or no history found — start fresh
      if (isMounted) setMessages([]);
    }
    load();
    return () => { isMounted = false; };
  }, [activeSessionId, isAuthenticated]);

  // Handle auto-search from navigation
  useEffect(() => {
    if (location.state?.autoSearchQuery && !hasAutoSearched) {
      handleSend(location.state.autoSearchQuery);
      setHasAutoSearched(true);
      window.history.replaceState({}, document.title);
    }
  }, [location, hasAutoSearched]);

  // Refresh profile when tab becomes visible (Profile tab updates)
  useEffect(() => {
    let isMounted = true;
    function handleFocus() {
      getProfile().then(p => {
        if (isMounted && p) setProfile(p);
      });
    }
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [getProfile]);

  async function handleSend(text) {
    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    
    // Auto-generate title if it's the first message
    const titleFallback = newMessages.length === 1 ? text.slice(0, 30) + (text.length > 30 ? '...' : '') : null;
    saveSessionMessages(activeSessionId, newMessages, titleFallback);
    
    // Also save user message to backend (only for authenticated users)
    if (isAuthenticated) {
      try {
        await saveChatMessage('user', text, jobMode);
      } catch (e) {
        // Ignore — guest users don't persist to backend
      }
    }
    
    setIsLoading(true);

    try {
      const result = await chat(text, newMessages, profile, personalization, jobMode);

      // Track search history for Smart Alerts (Feature 3)
      if (result.searchFilters) {
        const { company, role } = result.searchFilters;
        if (company || role) {
          await addSearchEntry({ company, role });
        }
      }

      // Track successful searches for notification prompt
      if (result.jobs && result.jobs.length > 0) {
        searchCount.current += 1;
        // After first successful search, prompt for notification permission
        if (searchCount.current === 1 && !hasAskedNotificationPermission() && 'Notification' in window && Notification.permission === 'default') {
          // Slight delay so user sees results first
          setTimeout(() => setShowNotifPrompt(true), 2000);
        }
      }

      const assistantMsg = {
        role: 'assistant',
        content: result.message || '',
        timestamp: new Date().toISOString(),
        jobs: result.jobs && result.jobs.length > 0 ? result.jobs : undefined,
        followUp: result.followUp || undefined,
        suggestions: result.suggestions || undefined,
        searchFilters: result.searchFilters || undefined,
      };

      const updatedMessages = [...newMessages, assistantMsg];
      setMessages(updatedMessages);
      saveSessionMessages(activeSessionId, updatedMessages);
      
      // Also save assistant message to backend (only for authenticated users)
      if (isAuthenticated) {
        try {
          const toSave = {
            message: result.message || '',
            jobs: result.jobs && result.jobs.length > 0 ? result.jobs : undefined,
            suggestions: result.suggestions || undefined,
            searchFilters: result.searchFilters || undefined,
          };
          await saveChatMessage('assistant', JSON.stringify(toSave), jobMode);
        } catch (e) {
          // Ignore
        }
      }
    } catch (err) {
      console.error('Chat error (client):', err);
      // The API layer should have already returned a fallback, but just in case:
      const errorMsg = {
        role: 'assistant',
        content: "hmm, that didn't work — but no worries! 😊 try asking again, or try one of these suggestions:",
        timestamp: new Date().toISOString(),
        suggestions: ['find me a job', 'react developer jobs', 'career advice', 'interview tips'],
      };
      const updatedMessages = [...newMessages, errorMsg];
      setMessages(updatedMessages);
      saveSessionMessages(activeSessionId, updatedMessages);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAllowNotifications() {
    Notification.requestPermission().then((permission) => {
      console.log('Notification permission:', permission);
    });
    setAskedNotificationPermission();
    setShowNotifPrompt(false);
  }

  function handleDismissNotifPrompt() {
    setAskedNotificationPermission();
    setShowNotifPrompt(false);
  }

  return (
    <div className="w-full h-full flex flex-col px-0 md:px-6 py-0 md:py-4" id="search-page">
      {/* Chat thread — full width */}
      <div className="flex-1 flex flex-col min-h-0 border-0 md:border md:border-[var(--color-border)] md:rounded-xl overflow-hidden">
        <ChatPanel
          key={activeSessionId || 'default'}
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          onApplied={() => {}}
        />
      </div>

      {/* Notification permission prompt */}
      {showNotifPrompt && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-[360px] z-[90] animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-xl">
            <p className="text-sm font-medium text-[var(--color-text-primary)] m-0 mb-1">
              🔔 Stay updated on new postings?
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] m-0 mb-3 leading-relaxed">
              We'll notify you when companies you've searched for post new roles — so you never miss an opening.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAllowNotifications}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white border-0 cursor-pointer transition-default hover:bg-[var(--color-accent-light)]"
              >
                Enable alerts
              </button>
              <button
                onClick={handleDismissNotifPrompt}
                className="px-3 py-2 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg bg-transparent cursor-pointer transition-default hover:bg-[var(--color-surface-alt)]"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
