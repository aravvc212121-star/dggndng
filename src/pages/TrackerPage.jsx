import { useState, useEffect } from 'react';
import { Trash2, ExternalLink, ClipboardList } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { useUserData } from '../utils/useUserData';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TrackerPage() {
  const { getApplications, updateApplicationStatus, deleteApplication } = useUserData();
  const [apps, setApps] = useState([]);

  useEffect(() => {
    let isMounted = true;
    getApplications().then(data => {
      if (isMounted) setApps(data || []);
    });
    
    function handleFocus() {
      getApplications().then(data => {
        if (isMounted) setApps(data || []);
      });
    }
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [getApplications]);

  async function handleStatusChange(id, status) {
    const updated = await updateApplicationStatus(id, status);
    setApps(updated || []);
  }

  async function handleDelete(id) {
    const updated = await deleteApplication(id);
    setApps(updated || []);
  }

  if (apps.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center" id="tracker-page">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-alt)] flex items-center justify-center mx-auto mb-4">
          <ClipboardList size={20} strokeWidth={1.5} className="text-[var(--color-text-tertiary)]" />
        </div>
        <h2 className="text-base font-medium text-[var(--color-text-primary)] m-0 mb-1">
          no applications yet
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] m-0">
          when you apply to jobs from the search page, they'll show up here.
        </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="h-full overflow-y-auto w-full"
        onScroll={e => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { scrollTop: e.currentTarget.scrollTop } }))}
      >
      <div className="max-w-4xl mx-auto px-4 pt-16 md:pt-6 pb-6" id="tracker-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-medium text-[var(--color-text-primary)] m-0">
          applications ({apps.length})
        </h1>
      </div>

      {/* Desktop: Table view */}
      <div className="hidden md:block border border-[var(--color-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[var(--color-surface-alt)]">
              <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] text-xs">role</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] text-xs">company</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] text-xs">date applied</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] text-xs">status</th>
              <th className="w-20 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] transition-default">
                <td className="px-4 py-3">
                  <span className="font-medium text-[var(--color-text-primary)]">{app.jobTitle}</span>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{app.company}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDate(app.appliedAt)}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={app.status}
                    onChange={(s) => handleStatusChange(app.id, s)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <a
                      href={app.applyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-alt)] transition-default"
                      title="Open application"
                    >
                      <ExternalLink size={14} strokeWidth={1.5} />
                    </a>
                    <button
                      onClick={() => handleDelete(app.id)}
                      className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer border-0 bg-transparent"
                      title="Remove"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="border border-[var(--color-border)] rounded-xl p-4 animate-fade-in"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] m-0 truncate">
                  {app.jobTitle}
                </h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] m-0 mt-0.5">
                  {app.company}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={app.applyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)]"
                >
                  <ExternalLink size={14} strokeWidth={1.5} />
                </a>
                <button
                  onClick={() => handleDelete(app.id)}
                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] border-0 bg-transparent cursor-pointer"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge
                status={app.status}
                onChange={(s) => handleStatusChange(app.id, s)}
              />
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {formatDate(app.appliedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
    
      {/* Top and Bottom Fades for Mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-[80px] bg-gradient-to-b from-[var(--color-surface)] from-[20px] to-transparent pointer-events-none z-30" />
    </>
  );
}
