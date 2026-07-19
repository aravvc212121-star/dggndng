import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import ResumeUpload from '../components/ResumeUpload';
import ResumeRoast from '../components/ResumeRoast';
import FollowButton from '../components/FollowButton';
import { parseResume } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useUserData } from '../utils/useUserData';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';

const PROFESSIONS = [
  'Software & IT', 'Engineering', 'Healthcare & Medicine', 'Finance & Accounting',
  'Business & Management', 'Legal', 'Education & Academia', 'Design & Creative',
  'Sales & Marketing', 'Consulting', 'Government & Public Sector', 'Other'
];
const DEGREE_LEVELS = ["Diploma", "Bachelor's", "Master's", "Doctorate", "Professional certification"];
const EXP_BANDS = ["Fresher / 0 years", "1–3 years", "3–5 years", "5–10 years", "10+ years"];
const COUNTRIES = ["India", "United States", "United Kingdom", "Canada", "Australia", "UAE", "Singapore", "Other"];

export default function ProfilePage({ personalization, onSavePersonalization }) {
  const { getProfile, saveProfile, getFollowedCompanies, toggleFollowCompany } = useUserData();
  const [profile, setProfile] = useState(null);
  const [resumeText, setResumeText] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [followedCompanies, setFollowedCompanies] = useState([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;
    getProfile().then(p => {
      if (isMounted && p) {
        setProfile(p);
        setResumeText(p.resumeText || null);
      }
    });
    getFollowedCompanies().then(c => {
      if (isMounted && c) setFollowedCompanies(c);
    });
    return () => { isMounted = false; };
  }, [getProfile, getFollowedCompanies]);

  const [formData, setFormData] = useState({
    profession: personalization?.profession || '',
    otherProfession: personalization?.otherProfession || '',
    degree: personalization?.degree || '',
    degreeLevel: personalization?.degreeLevel || '',
    experienceYears: personalization?.experienceYears || '',
    country: personalization?.country || '',
  });

  useEffect(() => {
    setFormData({
      profession: personalization?.profession || '',
      otherProfession: personalization?.otherProfession || '',
      degree: personalization?.degree || '',
      degreeLevel: personalization?.degreeLevel || '',
      experienceYears: personalization?.experienceYears || '',
      country: personalization?.country || '',
    });
  }, [personalization]);

  async function handleResumeParsed(text) {
    setResumeText(text);
    setParsing(true);
    setError(null);

    try {
      const result = await parseResume(text);
      const newProfile = {
        resumeText: text,
        name: result.name || '',
        email: result.email || '',
        summary: result.summary || '',
        skills: result.skills || [],
        experienceYears: result.experienceYears || 0,
        education: result.education || '',
        pastRoles: result.pastRoles || [],
      };
      await saveProfile(newProfile);
      setProfile(newProfile);
    } catch (err) {
      setError('Failed to parse resume. Make sure the API server is running.');
      const basicProfile = { resumeText: text, skills: [], experienceYears: 0 };
      await saveProfile(basicProfile);
      setProfile(basicProfile);
    } finally {
      setParsing(false);
    }
  }

  function handleSavePreferences(e) {
    e.preventDefault();
    if (onSavePersonalization) {
      onSavePersonalization({
        ...personalization,
        ...formData,
        profession: formData.profession === 'Other' ? formData.otherProfession : formData.profession,
      });
    }
  }

  function handleViewOpenings(company) {
    navigate('/', { state: { autoSearchQuery: `what's open at ${company}` } });
  }

  async function handleUnfollow(company) {
    await toggleFollowCompany(company);
    const updated = await getFollowedCompanies();
    setFollowedCompanies(updated);
  }

  function formatFollowDate(isoString) {
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file || !user || !supabase) return;
    
    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      // Use a consistent name to overwrite, avoid clutter
      const filePath = `${user.id}/photo`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      // Append timestamp to bypass browser cache
      const updatedUrl = `${publicUrl}?t=${Date.now()}`;
      const updated = { ...profile, avatarUrl: updatedUrl };
      await saveProfile(updated);
      setProfile(updated);
    } catch (err) {
      console.error('Avatar upload error:', err);
      alert('Failed to upload avatar. Check console for details.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <>
      <div
        className="h-full overflow-y-auto w-full"
        onScroll={e => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { scrollTop: e.currentTarget.scrollTop } }))}
      >
      <div className="max-w-2xl mx-auto px-4 pt-16 md:pt-6 pb-6" id="profile-page">
        <div className="flex items-center gap-5 mb-8">
          <div 
            className="w-16 h-16 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center overflow-hidden border border-[var(--color-border)] cursor-pointer relative group shrink-0"
            onClick={() => document.getElementById('avatar-upload')?.click()}
          >
            {isUploadingAvatar ? (
              <Loader size={20} className="animate-spin text-[var(--color-text-secondary)]" />
            ) : profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[var(--color-text-tertiary)] text-xl font-medium">
                {profile?.username ? profile.username.charAt(0).toUpperCase() : '?'}
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-default">
              <span className="text-[10px] text-white font-medium uppercase tracking-wider">Edit</span>
            </div>
          </div>
          <input 
            type="file" 
            id="avatar-upload" 
            className="hidden" 
            accept="image/*"
            onChange={handleAvatarUpload}
          />
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)] m-0">
              {profile?.username || 'Guest'}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] m-0 mt-0.5">
              {personalization?.profession || 'Job Seeker'}
            </p>
          </div>
        </div>

      {/* Resume upload */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] m-0 mb-3">
          resume
        </h2>
        <ResumeUpload onParsed={handleResumeParsed} existingProfile={profile} />
      </section>

      {/* Parsing indicator */}
      {parsing && (
        <div className="flex items-center gap-2 mb-6 text-sm text-[var(--color-text-secondary)]">
          <Loader size={14} strokeWidth={1.5} className="animate-spin" />
          extracting skills from your resume...
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--color-danger)] mb-4 m-0">{error}</p>
      )}

      {/* Job Preferences (Personalization) */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] m-0 mb-3">
          job preferences
        </h2>
        <form onSubmit={handleSavePreferences} className="space-y-4 border border-[var(--color-border)] p-4 rounded-xl">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profession */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Industry / Profession</label>
              <select
                value={formData.profession}
                onChange={e => setFormData({ ...formData, profession: e.target.value })}
                className="w-full text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
              >
                <option value="">Select industry...</option>
                {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {formData.profession === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify profession"
                  value={formData.otherProfession}
                  onChange={e => setFormData({ ...formData, otherProfession: e.target.value })}
                  className="w-full text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 mt-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
                />
              )}
            </div>

            {/* Experience */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Experience</label>
              <select
                value={formData.experienceYears}
                onChange={e => setFormData({ ...formData, experienceYears: e.target.value })}
                className="w-full text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
              >
                <option value="">Select experience...</option>
                {EXP_BANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            
            {/* Country */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Work Location</label>
              <select
                value={formData.country}
                onChange={e => setFormData({ ...formData, country: e.target.value })}
                className="w-full text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
              >
                <option value="">Select country...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Degree/Qualification */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Degree / Qualification</label>
              <div className="flex gap-2">
                <select
                  value={formData.degreeLevel}
                  onChange={e => setFormData({ ...formData, degreeLevel: e.target.value })}
                  className="w-[45%] text-xs border border-[var(--color-border)] rounded-lg px-2 py-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
                >
                  <option value="">Level...</option>
                  {DEGREE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="e.g. B.Tech in CS"
                  value={formData.degree}
                  onChange={e => setFormData({ ...formData, degree: e.target.value })}
                  className="flex-1 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium transition-default hover:bg-[var(--color-accent-light)] border-0 cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </section>


      {/* Extracted Details */}
      {profile && profile.resumeText && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] m-0 mb-3">
            extracted resume details
          </h2>
          <div className="border border-[var(--color-border)] rounded-xl p-5 space-y-5 bg-[var(--color-surface)] shadow-sm">
            
            {/* Header info */}
            {(profile.name || profile.email) && (
              <div className="border-b border-[var(--color-border)] pb-4">
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] m-0">{profile.name || 'Anonymous'}</h3>
                {profile.email && <p className="text-sm text-[var(--color-text-tertiary)] m-0 mt-1">{profile.email}</p>}
              </div>
            )}

            {/* Summary */}
            {profile.summary && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Professional Summary</span>
                <p className="text-sm text-[var(--color-text-secondary)] m-0 mt-1.5 leading-relaxed">{profile.summary}</p>
              </div>
            )}

            {/* Work & Edu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Experience</span>
                <p className="text-sm text-[var(--color-text-primary)] m-0 mt-1.5 font-medium">
                  {profile.experienceYears > 0 ? `${profile.experienceYears} ${profile.experienceYears === 1 ? 'year' : 'years'}` : 'Fresher / None'}
                </p>
              </div>
              
              {profile.education && (
                <div>
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Education</span>
                  <p className="text-sm text-[var(--color-text-primary)] m-0 mt-1.5 font-medium">{profile.education}</p>
                </div>
              )}
            </div>

            {/* Past Roles */}
            {profile.pastRoles && profile.pastRoles.length > 0 && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Past Roles</span>
                <div className="mt-2 space-y-2">
                  {profile.pastRoles.map((role, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-1.5 shrink-0" />
                      <p className="text-sm text-[var(--color-text-primary)] m-0 leading-snug">{role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">Top Skills</span>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs rounded-lg bg-[var(--color-surface-alt)] text-[var(--color-text-primary)] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </section>
      )}

      {/* Companies you follow */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] m-0 mb-3">
          companies you follow
        </h2>
        {followedCompanies.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] m-0 p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] shadow-sm">
            You're not following any companies yet — follow one from a job search to get notified about new openings.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {followedCompanies.map((item) => (
              <div key={item.company} className="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] shadow-sm">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)] m-0">{item.company}</h3>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] m-0 mt-0.5">
                    Following since {formatFollowDate(item.followedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewOpenings(item.company)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] cursor-pointer transition-default"
                  >
                    View openings
                  </button>
                  <button
                    onClick={() => handleUnfollow(item.company)}
                    className="p-1.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] cursor-pointer transition-default"
                    aria-label="Unfollow"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resume roast */}
      {resumeText && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-[var(--color-text-secondary)] m-0 mb-3">
            bonus
          </h2>
          <ResumeRoast resumeText={resumeText} />
        </section>
      )}

      {/* Data warning */}
      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-8 text-center">
        your profile is stored locally in this browser only. clearing browser data will remove it.
      </p>
      </div>
    </div>

      {/* Top and Bottom Fades for Mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-[80px] bg-gradient-to-b from-[var(--color-surface)] from-[20px] to-transparent pointer-events-none z-30" />
    </>
  );
}
