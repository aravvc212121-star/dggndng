/**
 * useUserData() — unified data-access hook.
 *
 * Internally checks auth state and routes reads/writes to either
 * Supabase (authenticated user) or localStorage (guest mode).
 *
 * Components call the same API regardless of auth state.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from './supabaseClient';
import * as storage from './storage';

/**
 * Check if current user is authenticated with Supabase.
 * This is a thin helper so we don't repeat this check everywhere.
 */
function useIsAuthenticated() {
  const { user } = useAuth();
  return !!user;
}

export function useUserData() {
  const { user } = useAuth();
  const isAuth = !!user;
  const userId = user?.id;

  // ─────────────────────────────────────────────
  //  PROFILE / PERSONALIZATION
  // ─────────────────────────────────────────────

  const getProfile = useCallback(async () => {
    if (!isAuth || !supabase) return storage.getProfile();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return storage.getProfile(); // fallback

    // Map Supabase row → existing profile shape used by components
    return {
      resumeText: data.resume_text,
      skills: data.skills || [],
      experienceYears: 0,
      education: data.field_of_study || '',
      name: '',
      email: '',
      summary: '',
      pastRoles: [],
      username: data.username || '',
      avatarUrl: data.avatar_url || '',
    };
  }, [isAuth, userId]);

  const getPersonalization = useCallback(async () => {
    if (!isAuth || !supabase) return storage.getPersonalization();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return storage.getPersonalization();

    return {
      profession: data.industry || '',
      degreeLevel: data.degree_level || '',
      degree: data.field_of_study || '',
      experienceYears: data.experience_level || '',
      country: data.work_location || '',
      skills: data.skills || [],
    };
  }, [isAuth, userId]);

  const saveProfile = useCallback(async (profile) => {
    // Always save to localStorage as cache
    storage.saveProfile(profile);

    if (!isAuth || !supabase) return;

    await supabase.from('profiles').upsert({
      id: userId,
      resume_text: profile?.resumeText !== undefined ? profile.resumeText : undefined,
      skills: profile?.skills !== undefined ? profile.skills : undefined,
      username: profile?.username !== undefined ? profile.username : undefined,
      avatar_url: profile?.avatarUrl !== undefined ? profile.avatarUrl : undefined,
      updated_at: new Date().toISOString(),
    });
  }, [isAuth, userId]);

  const savePersonalization = useCallback(async (data) => {
    // Always save to localStorage as cache
    storage.savePersonalization(data);

    if (!isAuth || !supabase) return;

    await supabase.from('profiles').upsert({
      id: userId,
      industry: data.profession || null,
      degree_level: data.degreeLevel || null,
      field_of_study: data.degree || null,
      experience_level: data.experienceYears || null,
      work_location: data.country || null,
      skills: data.skills || null,
      updated_at: new Date().toISOString(),
    });
  }, [isAuth, userId]);

  // ─────────────────────────────────────────────
  //  APPLICATIONS (TRACKER)
  // ─────────────────────────────────────────────

  const getApplications = useCallback(async () => {
    if (!isAuth || !supabase) return storage.getApplications();

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .order('applied_at', { ascending: false });

    if (error || !data) return storage.getApplications();

    return data.map(row => ({
      id: row.id,
      jobTitle: row.job_title,
      company: row.company,
      applyLink: row.apply_link,
      status: row.status,
      appliedAt: row.applied_at,
    }));
  }, [isAuth, userId]);

  const addApplication = useCallback(async (app) => {
    if (!isAuth || !supabase) return storage.addApplication(app);

    const row = {
      user_id: userId,
      job_title: app.jobTitle,
      company: app.company,
      apply_link: app.applyLink,
      status: 'Applied',
      applied_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('applications')
      .insert(row)
      .select()
      .single();

    if (error) {
      // Fallback to localStorage
      return storage.addApplication(app);
    }

    return {
      id: data.id,
      jobTitle: data.job_title,
      company: data.company,
      applyLink: data.apply_link,
      status: data.status,
      appliedAt: data.applied_at,
    };
  }, [isAuth, userId]);

  const updateApplicationStatus = useCallback(async (id, status) => {
    if (!isAuth || !supabase) return storage.updateApplicationStatus(id, status);

    await supabase
      .from('applications')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId);

    // Return fresh list
    return getApplications();
  }, [isAuth, userId, getApplications]);

  const deleteApplication = useCallback(async (id) => {
    if (!isAuth || !supabase) return storage.deleteApplication(id);

    await supabase
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return getApplications();
  }, [isAuth, userId, getApplications]);

  // ─────────────────────────────────────────────
  //  FOLLOWED COMPANIES
  // ─────────────────────────────────────────────

  const getFollowedCompanies = useCallback(async () => {
    if (!isAuth || !supabase) return storage.getFollowedCompanies();

    const { data, error } = await supabase
      .from('followed_companies')
      .select('*')
      .eq('user_id', userId)
      .order('followed_at', { ascending: false });

    if (error || !data) return storage.getFollowedCompanies();

    return data.map(row => ({
      company: row.company,
      followedAt: row.followed_at,
    }));
  }, [isAuth, userId]);

  const toggleFollowCompany = useCallback(async (company) => {
    if (!isAuth || !supabase) return storage.toggleFollowCompany(company);

    // Check if already following
    const { data: existing } = await supabase
      .from('followed_companies')
      .select('id')
      .eq('user_id', userId)
      .eq('company', company)
      .single();

    if (existing) {
      await supabase
        .from('followed_companies')
        .delete()
        .eq('id', existing.id)
        .eq('user_id', userId);
      return false; // unfollowed
    } else {
      await supabase
        .from('followed_companies')
        .insert({
          user_id: userId,
          company,
          followed_at: new Date().toISOString(),
        });
      return true; // followed
    }
  }, [isAuth, userId]);

  const isFollowingCompany = useCallback(async (company) => {
    if (!isAuth || !supabase) return storage.isFollowingCompany(company);

    const { data } = await supabase
      .from('followed_companies')
      .select('id')
      .eq('user_id', userId)
      .eq('company', company)
      .single();

    return !!data;
  }, [isAuth, userId]);

  // ─────────────────────────────────────────────
  //  SEARCH HISTORY
  // ─────────────────────────────────────────────

  const getSearchHistory = useCallback(async () => {
    if (!isAuth || !supabase) return storage.getSearchHistory();

    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', userId)
      .order('searched_at', { ascending: false })
      .limit(50);

    if (error || !data) return storage.getSearchHistory();

    return data.map(row => ({
      company: row.company,
      role: row.role,
      timestamp: row.searched_at,
    }));
  }, [isAuth, userId]);

  const addSearchEntry = useCallback(async (entry) => {
    if (!isAuth || !supabase) {
      storage.addSearchEntry(entry);
      return;
    }

    const { company, role } = entry;
    if (!company && !role) return;

    // Deduplicate: check if same combo exists
    const { data: existing } = await supabase
      .from('search_history')
      .select('id')
      .eq('user_id', userId)
      .ilike('company', company || '')
      .ilike('role', role || '')
      .limit(1);

    if (existing && existing.length > 0) return; // already exists

    await supabase.from('search_history').insert({
      user_id: userId,
      company: company || null,
      role: role || null,
      searched_at: new Date().toISOString(),
    });
  }, [isAuth, userId]);

  // ─────────────────────────────────────────────
  //  SETTINGS
  // ─────────────────────────────────────────────

  const getSettings = useCallback(async () => {
    const defaults = {
      defaultMode: 'job',
      notifyFollowed: true,
      notifySearchHistory: true,
      notifyDailyDigest: false,
    };

    if (!isAuth || !supabase) return storage.getSettings();

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return storage.getSettings();

    return {
      defaultMode: data.default_mode || 'job',
      notifyFollowed: data.notify_followed ?? true,
      notifySearchHistory: data.notify_search_history ?? true,
      notifyDailyDigest: data.notify_daily_digest ?? false,
    };
  }, [isAuth, userId]);

  const saveSettings = useCallback(async (settings) => {
    // Always update localStorage as cache
    storage.saveSettings(settings);

    if (!isAuth || !supabase) return;

    await supabase.from('settings').upsert({
      user_id: userId,
      default_mode: settings.defaultMode || 'job',
      notify_followed: settings.notifyFollowed ?? true,
      notify_search_history: settings.notifySearchHistory ?? true,
      notify_daily_digest: settings.notifyDailyDigest ?? false,
    });
  }, [isAuth, userId]);

  // ─────────────────────────────────────────────
  //  CLEAR ALL DATA
  // ─────────────────────────────────────────────
  
  const clearAllData = useCallback(async () => {
    // 1. Clear LocalStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('jobpilot_')) {
        localStorage.removeItem(key);
      }
    });

    if (isAuth && supabase) {
      // 2. Clear Supabase Tables
      // Reset profile (we upsert with nulls to keep the row but clear the data)
      await supabase.from('profiles').upsert({
        id: userId,
        resume_text: null,
        skills: null,
        industry: null,
        degree_level: null,
        field_of_study: null,
        experience_level: null,
        work_location: null,
        updated_at: new Date().toISOString(),
      });
      
      // Reset settings to defaults
      await supabase.from('settings').upsert({
        user_id: userId,
        default_mode: 'job',
        notify_followed: true,
        notify_search_history: true,
        notify_daily_digest: false,
      });

      // Delete from all other tables
      await supabase.from('applications').delete().eq('user_id', userId);
      await supabase.from('followed_companies').delete().eq('user_id', userId);
      await supabase.from('search_history').delete().eq('user_id', userId);
      
      // Also delete chat messages
      try {
        await supabase.from('chat_messages').delete().eq('user_id', userId);
      } catch (e) {
        // ignore if table doesn't exist or RLS blocks
      }
    }
  }, [isAuth, userId]);

  // ─────────────────────────────────────────────
  //  RETURN ALL METHODS
  // ─────────────────────────────────────────────

  return {
    isAuth,
    userId,

    // Profile / Personalization
    getProfile,
    getPersonalization,
    saveProfile,
    savePersonalization,

    // Applications
    getApplications,
    addApplication,
    updateApplicationStatus,
    deleteApplication,

    // Followed Companies
    getFollowedCompanies,
    toggleFollowCompany,
    isFollowingCompany,

    // Search History
    getSearchHistory,
    addSearchEntry,

    // Settings
    getSettings,
    saveSettings,

    // Clear All
    clearAllData,
  };
}
