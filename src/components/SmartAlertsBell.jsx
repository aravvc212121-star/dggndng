import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { getSearchHistory, getNotifications, markNotificationRead, clearNotifications } from '../utils/storage';

export default function SmartAlertsBell() {
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);

  // Load notifications on mount and periodically
  useEffect(() => {
    setNotifications(getNotifications());

    const interval = setInterval(() => {
      setNotifications(getNotifications());
    }, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  function animateClose() {
    setClosing(true);
    setTimeout(() => {
      setShowPanel(false);
      setClosing(false);
    }, 200);
  }

  function handleBellClick(e) {
    e.stopPropagation();
    if (showPanel) {
      animateClose();
    } else {
      setShowPanel(true);
      // Mark all as read when opening
      notifications.forEach(n => {
        if (!n.read) markNotificationRead(n.id);
      });
      setNotifications(getNotifications());
    }
  }

  function handleClearAll() {
    clearNotifications();
    setNotifications([]);
    animateClose();
  }

  function formatTimeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <>
      {/* Bell icon with badge */}
      <button
        onClick={handleBellClick}
        className="relative p-1.5 rounded-lg border-0 bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer"
        aria-label="Job alerts"
      >
        <Bell size={18} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold px-1 animate-fade-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {showPanel && createPortal(
        <div
          className={`fixed inset-0 z-[100] ${closing ? '' : ''}`}
          onClick={animateClose}
        >
          <div
            ref={panelRef}
            className={`fixed top-12 right-4 w-[320px] max-h-[400px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl flex flex-col overflow-hidden ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 101 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Job Alerts</span>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] border-0 bg-transparent cursor-pointer transition-default"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={animateClose}
                  className="p-1 rounded-md border-0 bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Notifications list */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Bell size={20} strokeWidth={1.5} className="text-[var(--color-text-tertiary)] mb-2" />
                  <p className="text-xs text-[var(--color-text-secondary)] m-0">No alerts yet</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] m-0 mt-1">
                    We'll notify you when companies you've searched for post new roles.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 ${!notif.read ? 'bg-[var(--color-surface-alt)]' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: 'rgba(26, 26, 46, 0.08)' }}
                      >
                        <span className="text-[10px] font-semibold text-[var(--color-accent)]">
                          {(notif.company || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[var(--color-text-primary)] m-0 leading-snug">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] m-0 mt-1">
                          {formatTimeAgo(notif.timestamp)}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
