import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Lightbulb, Target } from 'lucide-react';
import { getProfile } from '../utils/storage';
import { analyzeSkillGap } from '../utils/api';

// Session-level cache: jobApplyLink -> analysis result
const skillGapCache = new Map();

function CircularProgress({ percent, size = 36, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  // Color based on percentage
  let color = '#9b2c2c'; // low (danger)
  if (percent >= 70) color = '#2d6a4f'; // high (green)
  else if (percent >= 40) color = '#b5851b'; // medium (warning)

  return (
    <svg width={size} height={size} className="skill-match-ring">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {/* Percentage text */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.26}
        fontWeight="600"
        fill={color}
        fontFamily="var(--font-sans)"
      >
        {percent}%
      </text>
    </svg>
  );
}

function SkillGapPanel({ data, job, onClose }) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);

  function animateClose() {
    setClosing(true);
    setTimeout(() => onClose(), 250);
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') animateClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  let color = '#9b2c2c';
  if (data.matchPercent >= 70) color = '#2d6a4f';
  else if (data.matchPercent >= 40) color = '#b5851b';

  const overlay = (
    <div
      className={`job-detail-backdrop ${closing ? 'closing' : ''}`}
      onClick={animateClose}
    >
      <div
        ref={panelRef}
        className={`job-detail-card ${closing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border-dark)]" />
        </div>

        {/* Close button */}
        <button
          onClick={animateClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg border-0 bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-default z-10"
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3 space-y-4">
          {/* Header with score */}
          <div className="flex items-center gap-3">
            <CircularProgress percent={data.matchPercent} size={56} strokeWidth={4} />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] m-0">
                Skill Match Analysis
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
                {job.title} at {job.company}
              </p>
            </div>
          </div>

          {/* How it's calculated */}
          <div className="px-3 py-2.5 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={12} strokeWidth={1.5} style={{ color }} />
              <span className="text-xs font-medium" style={{ color }}>
                {data.matchPercent}% match
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] m-0 leading-relaxed">
              Based on {data.matchedSkills?.length || 0} of {(data.matchedSkills?.length || 0) + (data.missingSkills?.length || 0)} required skills matched from your resume.
            </p>
          </div>

          {/* Matched Skills */}
          {data.matchedSkills?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={13} strokeWidth={1.5} className="text-[var(--color-success)]" />
                <span className="text-xs font-medium text-[var(--color-text-primary)]">Skills You Have</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">{data.matchedSkills.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.matchedSkills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-[11px] rounded-md font-medium"
                    style={{ background: 'rgba(45, 106, 79, 0.08)', color: '#2d6a4f' }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills (The Gap) */}
          {data.missingSkills?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle size={13} strokeWidth={1.5} className="text-[var(--color-warning)]" />
                <span className="text-xs font-medium text-[var(--color-text-primary)]">Skills to Build</span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">{data.missingSkills.length}</span>
              </div>
              <div className="space-y-2">
                {data.missingSkills.map((skill, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
                    <span className="text-xs font-medium text-[var(--color-text-primary)] block">{skill}</span>
                    {data.suggestions?.[i] && (
                      <div className="flex items-start gap-1.5 mt-1">
                        <Lightbulb size={11} strokeWidth={1.5} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                        <span className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                          {data.suggestions[i]}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

export default function SkillMatchBadge({ job }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);

  // Check profile on mount
  const profile = getProfile();
  const hasResume = profile && profile.skills && profile.skills.length > 0;

  // Load cached analysis or fetch
  useEffect(() => {
    if (!hasResume || !job?.applyLink) return;

    const cached = skillGapCache.get(job.applyLink);
    if (cached) {
      setAnalysis(cached);
      return;
    }

    // Auto-fetch analysis in background
    setLoading(true);
    analyzeSkillGap(profile.skills, job)
      .then((result) => {
        skillGapCache.set(job.applyLink, result);
        setAnalysis(result);
      })
      .catch((err) => {
        console.error('Skill gap analysis failed:', err);
        // Set a fallback so we don't retry endlessly
        const fallback = { matchPercent: 0, matchedSkills: [], missingSkills: [], suggestions: [] };
        skillGapCache.set(job.applyLink, fallback);
        setAnalysis(fallback);
      })
      .finally(() => setLoading(false));
  }, [job?.applyLink, hasResume, profile?.skills]);

  // Long press handlers for the badge itself
  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowPanel(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.stopPropagation();
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    e.stopPropagation();
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (didLongPress.current) {
      e.preventDefault();
      didLongPress.current = false;
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowPanel(true);
    }, 500);
  }, []);

  const handleMouseUp = useCallback((e) => {
    e.stopPropagation();
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

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Desktop: also open on click for convenience
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (!didLongPress.current && analysis) {
      setShowPanel(true);
    }
  }, [analysis]);

  if (loading) {
    return (
      <div className="skill-match-badge" title="Analyzing skill match...">
        <div className="w-[30px] h-[30px] rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center animate-pulse">
          <span className="text-[9px] text-[var(--color-text-tertiary)]">...</span>
        </div>
      </div>
    );
  }

  if (!hasResume || !analysis || (analysis.matchPercent === 0 && analysis.matchedSkills?.length === 0 && analysis.missingSkills?.length === 0)) {
    return null;
  }

  return (
    <>
      <div
        className="skill-match-badge"
        title={`${analysis.matchPercent}% skill match — hold for details`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <CircularProgress percent={analysis.matchPercent} size={32} strokeWidth={2.5} />
      </div>

      {showPanel && analysis && (
        <SkillGapPanel
          data={analysis}
          job={job}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
}
