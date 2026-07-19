// localStorage keys
const KEYS = {
  PROFILE: 'jobpilot_profile',
  PERSONALIZATION: 'jobpilot_personalization',
  APPLICATIONS: 'jobpilot_applications',
  CHAT_HISTORY: 'jobpilot_chat_history',
  JOB_MODE: 'jobpilot_mode',
  SEARCH_HISTORY: 'jobpilot_search_history',
  NOTIFICATIONS: 'jobpilot_notifications',
  NOTIFICATION_PERMISSION: 'jobpilot_notif_permission_asked',
  SEEN_JOB_LINKS: 'jobpilot_seen_job_links',
  SETTINGS: 'jobpilot_settings',
  IS_GUEST: 'jobpilot_is_guest',
};

export function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getProfile() {
  try {
    const data = localStorage.getItem(KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify({
    ...profile,
    updatedAt: new Date().toISOString(),
  }));
}

export function getPersonalization() {
  try {
    const data = localStorage.getItem(KEYS.PERSONALIZATION);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function savePersonalization(data) {
  localStorage.setItem(KEYS.PERSONALIZATION, JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString(),
  }));
}

export function getApplications() {
  try {
    const data = localStorage.getItem(KEYS.APPLICATIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveApplications(apps) {
  localStorage.setItem(KEYS.APPLICATIONS, JSON.stringify(apps));
}

export function addApplication(app) {
  const apps = getApplications();
  const entry = {
    id: generateId(),
    jobTitle: app.jobTitle,
    company: app.company,
    applyLink: app.applyLink,
    status: 'Applied',
    appliedAt: new Date().toISOString(),
  };
  apps.unshift(entry);
  saveApplications(apps);
  return entry;
}

export function updateApplicationStatus(id, status) {
  const apps = getApplications();
  const idx = apps.findIndex(a => a.id === id);
  if (idx !== -1) {
    apps[idx].status = status;
    saveApplications(apps);
  }
  return apps;
}

export function deleteApplication(id) {
  const apps = getApplications().filter(a => a.id !== id);
  saveApplications(apps);
  return apps;
}

export function getSessions() {
  try {
    const data = localStorage.getItem(KEYS.CHAT_HISTORY); // reusing the key or use a new one, actually let's migrate
    const parsed = data ? JSON.parse(data) : [];
    
    // Migration: if the old format (array of messages) is found, convert to a single session
    if (parsed.length > 0 && !parsed[0].id) {
      const migratedSession = {
        id: 'default-session',
        title: 'Previous Chat',
        updatedAt: new Date().toISOString(),
        messages: parsed
      };
      saveSessions([migratedSession]);
      return [migratedSession];
    }
    
    return parsed;
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  // Keep last 20 sessions max to avoid bloated storage
  const trimmed = sessions.slice(0, 20);
  localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(trimmed));
}

export function getSession(id) {
  const sessions = getSessions();
  return sessions.find(s => s.id === id) || null;
}

export function saveSessionMessages(id, messages, titleFallback) {
  let sessions = getSessions();
  let session = sessions.find(s => s.id === id);
  
  if (session) {
    session.messages = messages;
    session.updatedAt = new Date().toISOString();
    if (!session.title && titleFallback) session.title = titleFallback;
  } else {
    // create new
    session = {
      id,
      title: titleFallback || 'New Chat',
      updatedAt: new Date().toISOString(),
      messages
    };
    sessions.unshift(session);
  }
  
  // Sort sessions by updatedAt descending
  sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  saveSessions(sessions);
}

export function deleteSession(id) {
  const sessions = getSessions().filter(s => s.id !== id);
  saveSessions(sessions);
  return sessions;
}

export function clearAllSessions() {
  localStorage.removeItem(KEYS.CHAT_HISTORY);
}

export function getJobMode() {
  try {
    const mode = localStorage.getItem(KEYS.JOB_MODE);
    return mode === 'career_chat' ? 'career_chat' : 'job';
  } catch {
    return 'job';
  }
}

export function saveJobMode(mode) {
  localStorage.setItem(KEYS.JOB_MODE, mode === 'career_chat' ? 'career_chat' : 'job');
}

// For You feed cache (avoid re-fetching within 1 hour)
export function getForYouCache() {
  try {
    const data = localStorage.getItem('jobpilot_foryou_cache');
    if (!data) return null;
    const parsed = JSON.parse(data);
    const age = Date.now() - (parsed.fetchedAt || 0);
    // Cache valid for 1 hour
    if (age > 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveForYouCache(jobs) {
  localStorage.setItem('jobpilot_foryou_cache', JSON.stringify({
    jobs,
    fetchedAt: Date.now(),
  }));
}

// ─── Search History (for Smart Alerts) ───

export function getSearchHistory() {
  try {
    const data = localStorage.getItem(KEYS.SEARCH_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addSearchEntry(entry) {
  const history = getSearchHistory();
  const { company, role } = entry;
  // Deduplicate: same company+role combo
  const exists = history.some(
    h => (h.company || '').toLowerCase() === (company || '').toLowerCase() &&
         (h.role || '').toLowerCase() === (role || '').toLowerCase()
  );
  if (!exists && (company || role)) {
    history.unshift({
      company: company || null,
      role: role || null,
      timestamp: new Date().toISOString(),
    });
    // Keep max 50 entries
    localStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(history.slice(0, 50)));
  }
}

// ─── Notifications ───

export function getNotifications() {
  try {
    const data = localStorage.getItem(KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addNotification(notif) {
  const notifications = getNotifications();
  notifications.unshift({
    id: generateId(),
    message: notif.message,
    company: notif.company || null,
    role: notif.role || null,
    jobLink: notif.jobLink || null,
    timestamp: new Date().toISOString(),
    read: false,
  });
  // Keep max 30 notifications
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications.slice(0, 30)));
}

export function markNotificationRead(id) {
  const notifications = getNotifications();
  const notif = notifications.find(n => n.id === id);
  if (notif) {
    notif.read = true;
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }
}

export function clearNotifications() {
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([]));
}

// ─── Seen Job Links (to detect new vs already-seen postings) ───

export function getSeenJobLinks() {
  try {
    const data = localStorage.getItem(KEYS.SEEN_JOB_LINKS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addSeenJobLinks(links) {
  const existing = new Set(getSeenJobLinks());
  links.forEach(l => existing.add(l));
  // Keep max 500
  const arr = [...existing].slice(-500);
  localStorage.setItem(KEYS.SEEN_JOB_LINKS, JSON.stringify(arr));
}

// ─── Browser Notification Permission ───

export function hasAskedNotificationPermission() {
  return localStorage.getItem(KEYS.NOTIFICATION_PERMISSION) === 'true';
}

export function setAskedNotificationPermission() {
  localStorage.setItem(KEYS.NOTIFICATION_PERMISSION, 'true');
}

// ─── Followed Companies ───

export function getFollowedCompanies() {
  try {
    const data = localStorage.getItem('jobpilot_followed_companies');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function toggleFollowCompany(company) {
  const companies = getFollowedCompanies();
  const idx = companies.findIndex(c => c.company === company);
  let isFollowing = false;
  if (idx !== -1) {
    companies.splice(idx, 1);
  } else {
    companies.unshift({ company, followedAt: new Date().toISOString() });
    isFollowing = true;
  }
  localStorage.setItem('jobpilot_followed_companies', JSON.stringify(companies));
  return isFollowing;
}

export function isFollowingCompany(company) {
  return getFollowedCompanies().some(c => c.company === company);
}

export function getFollowedLastChecked() {
  try {
    const data = localStorage.getItem('jobpilot_followed_last_checked');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveFollowedLastChecked(timestamps) {
  localStorage.setItem('jobpilot_followed_last_checked', JSON.stringify(timestamps));
}

// ─── Settings ───

export function getSettings() {
  try {
    const data = localStorage.getItem(KEYS.SETTINGS);
    const defaults = {
      defaultMode: 'job',
      notifyFollowed: true,
      notifySearchHistory: true,
      notifyDailyDigest: false,
    };
    return data ? { ...defaults, ...JSON.parse(data) } : defaults;
  } catch {
    return {
      defaultMode: 'job',
      notifyFollowed: true,
      notifySearchHistory: true,
      notifyDailyDigest: false,
    };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// ─── Guest Mode ───

export function getIsGuest() {
  try {
    return localStorage.getItem(KEYS.IS_GUEST) === 'true';
  } catch {
    return false;
  }
}

export function setGuestMode(isGuest) {
  localStorage.setItem(KEYS.IS_GUEST, isGuest ? 'true' : 'false');
}
