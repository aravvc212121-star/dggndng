import { useState, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { hasAskedNotificationPermission, setAskedNotificationPermission } from '../utils/storage';
import { useUserData } from '../utils/useUserData';

export default function FollowButton({ company, variant = 'card', onFollowAction }) {
  const { isFollowingCompany, toggleFollowCompany } = useUserData();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (company) {
      isFollowingCompany(company).then(state => {
        if (isMounted) setIsFollowing(state);
      });
    }
    return () => { isMounted = false; };
  }, [company, isFollowingCompany]);

  const handleToggle = async (e) => {
    if (e) e.stopPropagation();
    if (!company) return;

    const newState = await toggleFollowCompany(company);
    setIsFollowing(newState);

    if (newState && !hasAskedNotificationPermission() && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
      setAskedNotificationPermission();
    }

    if (onFollowAction) {
      onFollowAction(newState, company);
    }
  };

  const baseStyles = "relative inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-200 cursor-pointer overflow-hidden transform active:scale-[0.94] box-border border border-solid";
  
  const variantStyles = variant === 'inline' 
    ? "px-4 py-2 text-sm"
    : "px-3 py-1.5 text-xs";
    
  const stateStyles = isFollowing
    ? "bg-[var(--color-text-primary)] text-[var(--color-surface)] border-[var(--color-text-primary)]"
    : "bg-transparent text-[var(--color-text-primary)] border-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)]";

  return (
    <button 
      onClick={handleToggle}
      className={`${baseStyles} ${variantStyles} ${stateStyles}`}
    >
      <div className="flex items-center gap-1.5 relative z-10">
        {isFollowing ? (
          <Check size={variant === 'inline' ? 16 : 14} strokeWidth={2.5} />
        ) : (
          <Plus size={variant === 'inline' ? 16 : 14} strokeWidth={2} />
        )}
        <span>
          {variant === 'inline' 
            ? (isFollowing ? `Following ${company}` : `Follow ${company} for updates`) 
            : (isFollowing ? 'Following' : 'Follow')}
        </span>
      </div>
    </button>
  );
}
