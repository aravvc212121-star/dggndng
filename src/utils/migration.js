/**
 * Guest-to-account migration utility.
 * 
 * Reads all relevant localStorage keys, upserts them into Supabase tables
 * under the authenticated user's ID, then clears the migrated keys.
 * 
 * If migration fails partway, it surfaces a clear error and does NOT
 * clear local data — so the user never silently loses work.
 */
import { supabase } from './supabaseClient';

const LOCAL_KEYS = {
  PROFILE: 'jobpilot_profile',
  PERSONALIZATION: 'jobpilot_personalization',
  APPLICATIONS: 'jobpilot_applications',
  FOLLOWED_COMPANIES: 'jobpilot_followed_companies',
  SEARCH_HISTORY: 'jobpilot_search_history',
  SETTINGS: 'jobpilot_settings',
};

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if there is any local guest data worth migrating.
 */
export function hasLocalGuestData() {
  return Object.values(LOCAL_KEYS).some(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      // Check if it's an empty object/array
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (typeof parsed === 'object' && parsed !== null) return Object.keys(parsed).length > 0;
      return !!parsed;
    } catch {
      return false;
    }
  });
}

/**
 * Check if migration has already been completed for this user.
 */
export function isMigrationDone(userId) {
  return localStorage.getItem(`jobpilot_migrated_${userId}`) === 'true';
}

/**
 * Migrate all guest localStorage data to Supabase for the given user.
 * Throws on failure (caller should catch and surface to user).
 */
export async function migrateGuestDataToSupabase(userId) {
  if (!supabase || !userId) {
    throw new Error('Cannot migrate: Supabase not configured or no user ID');
  }

  // If already migrated for this user, skip
  if (isMigrationDone(userId)) return { migrated: false, reason: 'already_done' };

  // Check if there's any data to migrate
  if (!hasLocalGuestData()) {
    localStorage.setItem(`jobpilot_migrated_${userId}`, 'true');
    return { migrated: false, reason: 'no_data' };
  }

  const errors = [];

  // ─── 1. Migrate profile & personalization → profiles table ───
  try {
    const profile = safeGet(LOCAL_KEYS.PROFILE);
    const personalization = safeGet(LOCAL_KEYS.PERSONALIZATION);

    if (profile || personalization) {
      const profileRow = {
        id: userId,
        industry: personalization?.profession || null,
        degree_level: personalization?.degreeLevel || null,
        field_of_study: personalization?.degree || null,
        experience_level: personalization?.experienceYears || null,
        work_location: personalization?.country || null,
        resume_text: profile?.resumeText || null,
        skills: profile?.skills || personalization?.skills || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(profileRow);
      if (error) errors.push({ table: 'profiles', error: error.message });
    }
  } catch (e) {
    errors.push({ table: 'profiles', error: e.message });
  }

  // ─── 2. Migrate applications → applications table ───
  try {
    const apps = safeGet(LOCAL_KEYS.APPLICATIONS);
    if (apps && Array.isArray(apps) && apps.length > 0) {
      const rows = apps.map(app => ({
        user_id: userId,
        job_title: app.jobTitle || app.title || null,
        company: app.company || null,
        apply_link: app.applyLink || null,
        status: app.status || 'Applied',
        applied_at: app.appliedAt || new Date().toISOString(),
      }));

      const { error } = await supabase.from('applications').upsert(rows, {
        onConflict: 'id', // won't conflict since we're not setting id
        ignoreDuplicates: false,
      });
      if (error) {
        // Try inserting one by one as fallback
        for (const row of rows) {
          const { error: insertErr } = await supabase.from('applications').insert(row);
          if (insertErr) errors.push({ table: 'applications', error: insertErr.message, row: row.job_title });
        }
      }
    }
  } catch (e) {
    errors.push({ table: 'applications', error: e.message });
  }

  // ─── 3. Migrate followed companies → followed_companies table ───
  try {
    const followed = safeGet(LOCAL_KEYS.FOLLOWED_COMPANIES);
    if (followed && Array.isArray(followed) && followed.length > 0) {
      const rows = followed.map(f => ({
        user_id: userId,
        company: f.company,
        followed_at: f.followedAt || new Date().toISOString(),
      }));

      // Use insert with ON CONFLICT DO NOTHING (unique constraint on user_id + company)
      for (const row of rows) {
        const { error } = await supabase.from('followed_companies').upsert(row, {
          onConflict: 'user_id,company',
        });
        if (error) errors.push({ table: 'followed_companies', error: error.message, company: row.company });
      }
    }
  } catch (e) {
    errors.push({ table: 'followed_companies', error: e.message });
  }

  // ─── 4. Migrate search history → search_history table ───
  try {
    const history = safeGet(LOCAL_KEYS.SEARCH_HISTORY);
    if (history && Array.isArray(history) && history.length > 0) {
      const rows = history.map(h => ({
        user_id: userId,
        company: h.company || null,
        role: h.role || null,
        searched_at: h.timestamp || new Date().toISOString(),
      }));

      const { error } = await supabase.from('search_history').insert(rows);
      if (error) errors.push({ table: 'search_history', error: error.message });
    }
  } catch (e) {
    errors.push({ table: 'search_history', error: e.message });
  }

  // ─── 5. Migrate settings → settings table ───
  try {
    const settings = safeGet(LOCAL_KEYS.SETTINGS);
    if (settings && typeof settings === 'object') {
      const settingsRow = {
        user_id: userId,
        default_mode: settings.defaultMode || 'job',
        notify_followed: settings.notifyFollowed ?? true,
        notify_search_history: settings.notifySearchHistory ?? true,
        notify_daily_digest: settings.notifyDailyDigest ?? false,
        sheets_connected: false,
      };

      const { error } = await supabase.from('settings').upsert(settingsRow);
      if (error) errors.push({ table: 'settings', error: error.message });
    }
  } catch (e) {
    errors.push({ table: 'settings', error: e.message });
  }

  // ─── Check for errors ───
  if (errors.length > 0) {
    console.error('Migration errors:', errors);
    throw new Error(
      `Migration partially failed for: ${errors.map(e => e.table).join(', ')}. ` +
      `Your local data has NOT been cleared. Please try again or contact support.`
    );
  }

  // ─── Success: clear migrated localStorage keys ───
  Object.values(LOCAL_KEYS).forEach(key => localStorage.removeItem(key));
  // Also clear related keys
  localStorage.removeItem('jobpilot_followed_last_checked');
  localStorage.removeItem('jobpilot_foryou_cache');
  
  // Mark migration as done for this user
  localStorage.setItem(`jobpilot_migrated_${userId}`, 'true');

  return { migrated: true };
}
