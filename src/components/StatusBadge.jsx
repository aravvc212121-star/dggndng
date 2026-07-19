import { useState, useRef, useEffect } from 'react';

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected'];

const statusClass = {
  Applied: 'status-applied',
  Interview: 'status-interview',
  Offer: 'status-offer',
  Rejected: 'status-rejected',
};

export default function StatusBadge({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-2.5 py-1 text-xs rounded-full border bg-transparent cursor-pointer transition-default ${statusClass[status] || 'status-applied'}`}
      >
        {status.toLowerCase()}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[var(--color-border)] rounded-lg shadow-sm py-1 min-w-[120px] animate-fade-in">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer border-0 bg-transparent ${
                s === status ? 'font-medium text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
