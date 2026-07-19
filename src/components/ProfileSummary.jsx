import { User, Briefcase, GraduationCap } from 'lucide-react';

export default function ProfileSummary({ profile }) {
  if (!profile) {
    return (
      <div className="border border-[var(--color-border)] rounded-xl p-5" id="profile-summary">
        <div className="flex items-center gap-2 mb-3">
          <User size={16} strokeWidth={1.5} className="text-[var(--color-text-tertiary)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">your profile</span>
        </div>
        <p className="text-sm text-[var(--color-text-tertiary)] m-0">
          upload a resume in the profile tab to get personalized job matching and relevance scores.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-5" id="profile-summary">
      <div className="flex items-center gap-2 mb-3">
        <User size={16} strokeWidth={1.5} className="text-[var(--color-accent)]" />
        <span className="text-sm font-medium text-[var(--color-text-primary)]">your profile</span>
      </div>

      {profile.experienceYears !== undefined && (
        <div className="flex items-center gap-2 mb-2">
          <Briefcase size={14} strokeWidth={1.5} className="text-[var(--color-text-tertiary)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {profile.experienceYears} {profile.experienceYears === 1 ? 'year' : 'years'} experience
          </span>
        </div>
      )}

      {profile.education && (
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={14} strokeWidth={1.5} className="text-[var(--color-text-tertiary)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">{profile.education}</span>
        </div>
      )}

      {profile.skills && profile.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.slice(0, 8).map((skill, i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-xs rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]"
            >
              {skill}
            </span>
          ))}
          {profile.skills.length > 8 && (
            <span className="px-2 py-0.5 text-xs text-[var(--color-text-tertiary)]">
              +{profile.skills.length - 8} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
