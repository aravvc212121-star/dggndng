import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Clock, RefreshCw, Settings2 } from 'lucide-react';
import { fetchForYou } from '../utils/api';
import { getPersonalization, getForYouCache, saveForYouCache } from '../utils/storage';
import { useUserData } from '../utils/useUserData';
import JobCard from '../components/JobCard';

export default function ForYouPage({ personalization, onNewJobs, unseenFollowedCount = 0, clearUnseenFollowed }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [incomplete, setIncomplete] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const { getProfile } = useUserData();

  const hasProfile = personalization && (personalization.profession || personalization.degree || personalization.country);

  const loadJobs = useCallback(async (forceRefresh = false) => {
    if (!hasProfile) {
      setIncomplete(true);
      return;
    }

    // Check cache first
    if (!forceRefresh) {
      const cached = getForYouCache();
      if (cached && cached.jobs?.length > 0) {
        setJobs(cached.jobs);
        setLastFetched(new Date(cached.fetchedAt));
        setIncomplete(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const profile = await getProfile();
      const result = await fetchForYou(personalization, profile);
      if (result.incomplete) {
        setIncomplete(true);
        setJobs([]);
      } else {
        const fetchedJobs = result.jobs || [];
        setJobs(fetchedJobs);
        setIncomplete(false);
        saveForYouCache(fetchedJobs);
        setLastFetched(new Date());
        
        // Trigger smart alerts check with newly fetched jobs
        if (onNewJobs && forceRefresh) {
          onNewJobs(fetchedJobs);
        } else if (onNewJobs && !getForYouCache()) {
           onNewJobs(fetchedJobs);
        }
      }
    } catch (err) {
      console.error('For You fetch error:', err);
      setError('Failed to load recommendations. Pull to refresh.');
    } finally {
      setIsLoading(false);
    }
  }, [hasProfile, personalization]);

  useEffect(() => {
    loadJobs();
    if (unseenFollowedCount > 0 && clearUnseenFollowed) {
      clearUnseenFollowed();
    }
  }, [loadJobs, unseenFollowedCount, clearUnseenFollowed]);

  function formatTimeAgo(date) {
    if (!date) return '';
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  // Empty state — incomplete profile
  if (incomplete && !isLoading) {
    return (
      <div className="w-full h-[100dvh] md:h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-alt)] flex items-center justify-center mb-4">
          <Settings2 size={24} strokeWidth={1.5} className="text-[var(--color-text-tertiary)]" />
        </div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] m-0 mb-2">
          set up your profile first
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] m-0 mb-6 max-w-xs leading-relaxed">
          the "jobs" feed uses your profession, skills, and location to find relevant jobs automatically. tap the <strong>J</strong> logo to open the sidebar and fill in your profile.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
          <Briefcase size={14} strokeWidth={1.5} />
          <span>personalized jobs will appear here</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col" id="foryou-page">
      {/* Header */}
      <div className="px-4 pt-14 md:pt-5 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase size={18} strokeWidth={1.5} className="text-[var(--color-accent)]" />
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)] m-0">jobs</h1>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] m-0 mt-0.5">
            fresh jobs based on your profile
            {lastFetched && <> · updated {formatTimeAgo(lastFetched)}</>}
          </p>
        </div>
        <button
          onClick={() => loadJobs(true)}
          disabled={isLoading}
          className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] cursor-pointer transition-default ${isLoading ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto px-4 pt-3 pb-6"
        onScroll={e => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { scrollTop: e.currentTarget.scrollTop } }))}
      >
        {/* Loading skeleton */}
        {isLoading && jobs.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-[var(--color-border)] p-4 h-44">
                <div className="h-3 w-3/4 bg-[var(--color-border)] rounded mb-3" />
                <div className="h-2.5 w-1/2 bg-[var(--color-border)] rounded mb-2" />
                <div className="h-2.5 w-2/3 bg-[var(--color-border)] rounded mb-4" />
                <div className="h-8 w-full bg-[var(--color-border)] rounded-lg mt-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--color-danger)] m-0 mb-3">{error}</p>
            <button
              onClick={() => loadJobs(true)}
              className="px-4 py-2 text-xs rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] text-white cursor-pointer transition-default"
            >
              try again
            </button>
          </div>
        )}

        {/* Job cards grid */}
        {!isLoading && !error && jobs.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {jobs.map((job, i) => (
              <div key={job.applyLink || i} className="relative">
                {/* Recency badge */}
                {job.postedHoursAgo && (
                  <div className="absolute -top-1.5 left-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-medium shadow-sm">
                    <Clock size={9} strokeWidth={2} />
                    {job.postedHoursAgo}h ago
                  </div>
                )}
                <JobCard job={job} compact={true} onApplied={() => {}} />
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!isLoading && !error && jobs.length === 0 && !incomplete && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase size={24} strokeWidth={1.5} className="text-[var(--color-text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)] m-0 mb-1">no new jobs right now</p>
            <p className="text-xs text-[var(--color-text-tertiary)] m-0">check back later — we refresh every hour</p>
          </div>
        )}

        {/* Loading overlay for refresh */}
        {isLoading && jobs.length > 0 && (
          <div className="fixed inset-0 bg-[var(--color-surface)]/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg">
              <RefreshCw size={14} className="animate-spin text-[var(--color-accent)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">refreshing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
