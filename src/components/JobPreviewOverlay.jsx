import { createPortal } from 'react-dom';
import { ShieldCheck, ShieldQuestion, X, ExternalLink, MapPin, Building2, Briefcase, Star } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { addApplication, getApplications } from '../utils/storage';

function isVerifiedSource(job) {
  if (!job) return false;
  const link = (job.applyLink || '').toLowerCase();
  const id = (job.id || '').toString().toLowerCase();
  if (link.includes('greenhouse.io') || link.includes('lever.co')) return true;
  if (!id.startsWith('serper-') && !id.startsWith('tavily-') && !id.match(/^[a-f0-9-]+$/)) return true;
  return false;
}

function getCompanyInitial(company) {
  return (company || '?').charAt(0).toUpperCase();
}

function getCompanyBlurb(company) {
  const name = company || 'This company';
  return `${name} is hiring for this position. Visit their careers page for more details about the team, culture, and benefits.`;
}

function getRoleSummary(job) {
  if (job.reason && job.reason !== 'Matched by search filters') {
    return job.reason;
  }
  const parts = [job.title];
  if (job.company) parts.push(`at ${job.company}`);
  if (job.location) parts.push(`based in ${job.location}`);
  return `${parts.join(' ')}. Check the full listing for responsibilities, requirements, and application details.`;
}

function getJobDescription(job) {
  if (job.description) return job.description;
  const parts = [];
  parts.push(`This is a ${job.title} position at ${job.company || 'the company'}.`);
  if (job.location) parts.push(`The role is based in ${job.location}.`);
  if (job.salary) parts.push(`Salary range: ${job.salary}.`);
  parts.push('Visit the application link for the complete job description, responsibilities, and requirements.');
  return parts.join(' ');
}

export default function JobPreviewOverlay({ job, onClose, onApplied }) {
  if (!job) return null;

  const verified = isVerifiedSource(job);
  const score = job.relevanceScore || 0;
  const barOpacity = Math.max(0.2, score / 100);

  const [applied, setApplied] = useState(() => {
    const apps = getApplications();
    return apps.some(a => a.applyLink === job.applyLink);
  });
  const [closing, setClosing] = useState(false);

  // Swipe-to-dismiss tracking
  const dragY = useRef(0);
  const cardRef = useRef(null);
  const startY = useRef(0);
  const isDragging = useRef(false);

  function handleApply() {
    if (!applied) {
      addApplication({
        jobTitle: job.title,
        company: job.company,
        applyLink: job.applyLink,
      });
      setApplied(true);
      if (onApplied) onApplied();
    }
    window.open(job.applyLink, '_blank', 'noopener,noreferrer');
  }

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

  // Swipe-down-to-dismiss handlers
  const handleTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = false;
    dragY.current = 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 10) {
      isDragging.current = true;
      dragY.current = dy;
      if (cardRef.current) {
        cardRef.current.style.transform = `translateY(${dy}px)`;
        cardRef.current.style.opacity = `${Math.max(0.5, 1 - dy / 400)}`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isDragging.current && dragY.current > 120) {
      animateClose();
    } else if (cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.opacity = '';
    }
    isDragging.current = false;
    dragY.current = 0;
  }, []);

  const overlay = (
    <div
      className={`job-detail-backdrop ${closing ? 'closing' : ''}`}
      onClick={animateClose}
    >
      <div
        ref={cardRef}
        className={`job-detail-card ${closing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2 space-y-5">
          {/* Company header */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(26, 26, 46, 0.08)' }}
            >
              <span className="text-base font-semibold text-[var(--color-accent)]">
                {getCompanyInitial(job.company)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] m-0 truncate">
                {job.company}
              </p>
              <span className={`verification-badge ${verified ? 'verified' : 'unverified'}`}>
                {verified ? <ShieldCheck size={11} /> : <ShieldQuestion size={11} />}
                {verified ? 'Verified source' : 'Unverified'}
              </span>
            </div>
          </div>

          {/* Job title + meta */}
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] m-0 mb-2 leading-snug">
              {job.title}
            </h2>
            <div className="flex flex-wrap gap-2">
              {job.location && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)] px-2.5 py-1 rounded-lg">
                  <MapPin size={12} strokeWidth={1.5} />
                  {job.location}
                </span>
              )}
              {job.company && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)] px-2.5 py-1 rounded-lg">
                  <Building2 size={12} strokeWidth={1.5} />
                  {job.company}
                </span>
              )}
              {job.salary && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)] px-2.5 py-1 rounded-lg">
                  <Briefcase size={12} strokeWidth={1.5} />
                  {job.salary}
                </span>
              )}
            </div>
          </div>

          {/* Relevance score */}
          <div className="p-3.5 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Star size={14} strokeWidth={1.5} className="text-[var(--color-accent)]" />
              <span className="text-xs font-medium text-[var(--color-text-primary)]">Relevance Score</span>
              <span
                className="ml-auto text-sm font-semibold tabular-nums px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `rgba(26, 26, 46, ${barOpacity * 0.12})`,
                  color: `rgba(26, 26, 46, ${Math.max(0.5, barOpacity)})`,
                }}
              >
                {score}/100
              </span>
            </div>
            {/* Score bar */}
            <div className="w-full h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
            {job.reason && (
              <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-2 leading-relaxed">
                {job.reason}
              </p>
            )}
          </div>

          {/* About the company */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] m-0 mb-1.5 uppercase tracking-wider">
              About the company
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
              {getCompanyBlurb(job.company)}
            </p>
          </div>

          {/* Job description */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] m-0 mb-1.5 uppercase tracking-wider">
              Job description
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed whitespace-pre-line">
              {getJobDescription(job)}
            </p>
          </div>
        </div>

        {/* Sticky apply button at bottom */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={handleApply}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl transition-default cursor-pointer border ${
              applied
                ? 'border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)]'
                : 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-light)]'
            }`}
          >
            <ExternalLink size={16} strokeWidth={1.5} />
            {applied ? 'Applied — View Again' : 'Apply Now'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
