import { useState } from 'react';
import { Flame, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { roastResume } from '../utils/api';

export default function ResumeRoast({ resumeText }) {
  const [roast, setRoast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);

  async function handleRoast() {
    if (roast) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await roastResume(resumeText);
      setRoast(result.roast);
      setExpanded(true);
    } catch (err) {
      setError('Failed to generate roast. Check your API configuration.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="resume-roast">
      <button
        onClick={handleRoast}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-dark)] hover:text-[var(--color-text-primary)] transition-default cursor-pointer"
      >
        {loading ? (
          <Loader size={14} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Flame size={14} strokeWidth={1.5} />
        )}
        {loading ? 'roasting...' : roast ? 'roast my resume' : 'roast my resume'}
        {roast && (expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>

      {error && (
        <p className="text-xs text-[var(--color-danger)] mt-2 m-0">{error}</p>
      )}

      {expanded && roast && (
        <div className="mt-3 border border-[var(--color-border)] rounded-xl p-5 animate-fade-in">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] m-0 mb-3 flex items-center gap-2">
            <Flame size={14} strokeWidth={1.5} className="text-[var(--color-danger)]" />
            resume roast
          </h3>
          <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed space-y-3">
            {roast.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} className="m-0">{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
