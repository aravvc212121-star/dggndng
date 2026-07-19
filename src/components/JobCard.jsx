import { ExternalLink, MapPin, Building2 } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import JobPreviewOverlay from './JobPreviewOverlay';
import SkillMatchBadge from './SkillMatchBadge';
import { useUserData } from '../utils/useUserData';

const LONG_PRESS_MS = 500;

export default function JobCard({ job, compact, onApplied }) {
  const { getApplications, addApplication } = useUserData();
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getApplications().then(apps => {
      if (isMounted && apps) {
        setApplied(apps.some(a => a.applyLink === job.applyLink));
      }
    });
    return () => { isMounted = false; };
  }, [getApplications, job.applyLink]);

  const [showPreview, setShowPreview] = useState(false);

  // Long-press tracking
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);

  const score = job.relevanceScore || 0;
  const barOpacity = Math.max(0.2, score / 100);

  async function handleApply(e) {
    if (e) e.stopPropagation();
    if (!applied) {
      await addApplication({
        jobTitle: job.title,
        company: job.company,
        applyLink: job.applyLink,
      });
      setApplied(true);
      if (onApplied) onApplied();
    }
    window.open(job.applyLink, '_blank', 'noopener,noreferrer');
  }

  // --- Long press handlers (touch) ---
  const handleTouchStart = useCallback((e) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowPreview(true);
    }, LONG_PRESS_MS);
  }, []);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if finger moves
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Prevent the tap from triggering apply if it was a long press
    if (didLongPress.current) {
      e.preventDefault();
      didLongPress.current = false;
    }
  }, []);

  // --- Long press handlers (mouse / desktop) ---
  const handleMouseDown = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowPreview(true);
    }, LONG_PRESS_MS);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Prevent context menu on long press (mobile)
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  const PASTEL_COLORS = [
    'bg-blue-50/60 border-blue-100',
    'bg-green-50/60 border-green-100',
    'bg-yellow-50/60 border-yellow-100',
    'bg-red-50/60 border-red-100',
    'bg-purple-50/60 border-purple-100',
    'bg-orange-50/60 border-orange-100',
    'bg-emerald-50/60 border-emerald-100',
    'bg-indigo-50/60 border-indigo-100',
  ];

  const hash = (job.title + job.company).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0;
  const colorClass = PASTEL_COLORS[hash % PASTEL_COLORS.length];

  const longPressHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onContextMenu: handleContextMenu,
  };

  // Grid card variant — used inline in chat
  if (compact) {
    return (
      <>
        <div
          className={`animate-fade-in relative flex flex-col justify-between p-3.5 border rounded-xl hover:border-[var(--color-accent)] transition-default h-full ${colorClass} group select-none`}
          {...longPressHandlers}
        >
          {/* Score badge top-right */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="text-[13px] font-medium text-[var(--color-text-primary)] m-0 leading-snug line-clamp-2">
                {job.title}
              </h4>
              <span
                className="shrink-0 text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `rgba(26, 26, 46, ${barOpacity * 0.12})`,
                  color: `rgba(26, 26, 46, ${Math.max(0.5, barOpacity)})`,
                }}
              >
                {score}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] mb-1">
              <Building2 size={11} strokeWidth={1.5} className="shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>

            {job.location && (
              <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)] mb-2">
                <MapPin size={11} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{job.location}</span>
              </div>
            )}

            {job.reason && (
              <p className="text-[11px] text-[var(--color-text-tertiary)] m-0 mb-2 line-clamp-2 leading-relaxed">
                {job.reason}
              </p>
            )}
          </div>

          {/* Apply button — full width at bottom */}
          <button
            onClick={handleApply}
            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-default cursor-pointer border mt-auto ${
              applied
                ? 'border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)]'
                : 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-light)]'
            }`}
          >
            <ExternalLink size={12} strokeWidth={1.5} />
            {applied ? 'applied' : 'apply'}
          </button>

          {/* Skill match badge + Long press hint row */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="skill-match-badge-wrapper">
              <SkillMatchBadge job={job} />
            </div>
            <p className="text-[9px] text-[var(--color-text-tertiary)] m-0 text-center opacity-0 group-hover:opacity-60 transition-default">
              hold to preview
            </p>
          </div>
        </div>

        {/* Full-detail overlay portal */}
        {showPreview && (
          <JobPreviewOverlay
            job={job}
            onClose={() => setShowPreview(false)}
            onApplied={onApplied}
          />
        )}
      </>
    );
  }

  // Full variant (kept for compatibility)
  return (
    <>
      <div
        className="animate-fade-in relative flex items-stretch gap-3 p-4 border border-[var(--color-border)] rounded-xl hover:border-[var(--color-border-dark)] transition-default group select-none"
        {...longPressHandlers}
      >
        <div
          className="relevance-bar shrink-0 hidden sm:block"
          style={{ backgroundColor: `rgba(26, 26, 46, ${barOpacity})` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate m-0">{job.title}</h3>
              <p className="text-[13px] text-[var(--color-text-secondary)] m-0 mt-0.5 truncate">
                {job.company}{job.location && <> · {job.location}</>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SkillMatchBadge job={job} />
              <span className="text-sm font-medium text-[var(--color-accent)] tabular-nums">{score}</span>
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={handleApply}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-default cursor-pointer border ${
                applied
                  ? 'border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)]'
                  : 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-light)]'
              }`}
            >
              <ExternalLink size={12} strokeWidth={1.5} />
              {applied ? 'applied' : 'apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Full-detail overlay portal */}
      {showPreview && (
        <JobPreviewOverlay
          job={job}
          onClose={() => setShowPreview(false)}
          onApplied={onApplied}
        />
      )}
    </>
  );
}
