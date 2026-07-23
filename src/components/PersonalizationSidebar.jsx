import { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, UserCircle2, MessageSquare, SquarePen, History, Search, Briefcase, ClipboardList, User, Compass, PanelLeftClose, Menu, Settings, Newspaper, ChevronDown, Trash2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { parseResume } from '../utils/api';
import { getSessions, deleteSession } from '../utils/storage';

const PROFESSIONS = [
  'Software & IT', 'Engineering', 'Healthcare & Medicine', 'Finance & Accounting',
  'Business & Management', 'Legal', 'Education & Academia', 'Design & Creative',
  'Sales & Marketing', 'Consulting', 'Government & Public Sector', 'Other'
];

const DEGREE_LEVELS = ["Diploma", "Bachelor's", "Master's", "Doctorate", "Professional certification"];
const EXP_BANDS = ["Fresher / 0 years", "1–3 years", "3–5 years", "5–10 years", "10+ years"];
const COUNTRIES = ["India", "United States", "United Kingdom", "Canada", "Australia", "UAE", "Singapore", "Other"];

export default function PersonalizationSidebar({ isOpen, onClose, data, onSave, activeSessionId, onSelectSession, onNewChat, jobMode, onToggleJobMode, unseenFollowedCount = 0, isCollapsed, onToggleCollapse }) {
  const [formData, setFormData] = useState({
    profession: data?.profession || '',
    otherProfession: data?.otherProfession || '',
    degree: data?.degree || '',
    degreeLevel: data?.degreeLevel || '',
    experienceYears: data?.experienceYears || '',
    country: data?.country || '',
    resumeText: data?.resumeText || '',
    skills: data?.skills || [],
  });

  const [sessions, setSessions] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(true);
  const fileInputRef = useRef(null);

  // Load sessions when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setSessions(getSessions());
    }
  }, [isOpen]);

  const handleDeleteSession = (e, sessionId) => {
    e.stopPropagation(); // prevent clicking the session
    const newSessions = deleteSession(sessionId);
    setSessions(newSessions);
    // If we deleted the currently active session, start a new chat
    if (activeSessionId === sessionId) {
      onNewChat();
    }
  };

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      if (!pdfjsLib) throw new Error('PDF.js not loaded');

      pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      // Parse with Groq to get skills
      const parsedData = await parseResume(fullText);
      
      setFormData(prev => ({
        ...prev,
        resumeText: fullText,
        skills: parsedData.skills || prev.skills,
      }));

    } catch (error) {
      console.error(error);
      alert('Failed to parse resume. Try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...formData,
      profession: formData.profession === 'Other' ? formData.otherProfession : formData.profession,
    });
  }

  // Mobile overlay styles
  const overlayClasses = isOpen ? 'fixed inset-0 bg-black/40 z-[70] transition-opacity' : 'fixed inset-0 bg-black/0 pointer-events-none z-[70] transition-opacity';
  const panelClasses = isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0';
  const widthClasses = isCollapsed ? 'lg:w-[72px]' : 'lg:w-[280px]';

  return (
    <>
      {/* Mobile backdrop */}
      <div className={`lg:hidden ${overlayClasses}`} onClick={onClose} />

      {/* Sidebar Panel */}
      <div className={`fixed lg:relative z-[80] top-0 left-0 h-full w-[85%] max-w-xs bg-[var(--color-surface)] border-r border-[var(--color-border)] transform transition-all duration-300 flex flex-col shrink-0 overflow-hidden ${panelClasses} ${widthClasses}`}>
        
        {/* Header */}
        <div className={`flex transition-all ${isCollapsed ? 'flex-col items-center p-3 gap-4' : 'items-center justify-between p-4'}`}>
          <div className="flex items-center gap-2 no-underline cursor-default">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
              <img src="/jobsy-logo.png" alt="Jobsy" className="w-full h-full object-contain" />
            </div>
            <span className={`text-[var(--color-text-primary)] font-medium text-base ${isCollapsed ? 'hidden' : 'block'}`}>Jobsy</span>
          </div>
          <button 
            onClick={() => window.innerWidth >= 1024 ? onToggleCollapse() : onClose()} 
            className="p-1.5 rounded-md hover:bg-[var(--color-surface-alt)] transition-default cursor-pointer border-0 bg-transparent text-[var(--color-text-secondary)]"
            title={isCollapsed ? "Expand sidebar" : "Close sidebar"}
          >
            <Menu size={24} strokeWidth={1.25} />
          </button>
        </div>

        {/* Form & Recent Chats Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* Navigation Section */}
          <div className="w-full">
            <div className={`flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-primary)] mb-3 ${isCollapsed ? 'hidden' : ''}`}>
              <Compass size={14} />
              <span>Navigation</span>
            </div>
            <div className="flex flex-col gap-1">
              {[
                { to: '/', label: 'Search', icon: Search },
                { to: '/foryou', label: 'Jobs', icon: Briefcase, badgeCount: unseenFollowedCount },
                { to: '/tracker', label: 'Tracker', icon: ClipboardList },
                { to: '/news', label: 'News', icon: Newspaper },
                { to: '/profile', label: 'Profile', icon: User },
                { to: '/settings', label: 'Settings', icon: Settings },
              ].map(({ to, label, icon: Icon, badgeCount }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => window.innerWidth < 1024 && onClose()} // close on mobile only
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 text-sm rounded-lg border-0 transition-default no-underline truncate w-full relative ${
                      isActive
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-primary)]'
                    } ${isCollapsed ? 'justify-center py-3' : 'py-2'}`
                  }
                >
                  <div className={`relative flex items-center justify-center ${isCollapsed ? 'w-full' : ''}`}>
                    <Icon size={isCollapsed ? 22 : 16} strokeWidth={isCollapsed ? 1.5 : 2} className="shrink-0 transition-all duration-300" />
                    {badgeCount > 0 && (
                      <span className={`absolute rounded-full bg-red-500 transition-all ${isCollapsed ? '-top-1.5 right-1 w-2.5 h-2.5' : '-top-1 -right-1.5 w-2 h-2'}`} />
                    )}
                  </div>
                  <span className={`truncate flex-1 transition-opacity duration-300 ${isCollapsed ? 'hidden' : 'block'}`}>{label}</span>
                </NavLink>
              ))}
            </div>

            {/* Job mode toggle */}
            <div className={`flex items-center justify-between mt-4 px-3 py-2 rounded-lg bg-[var(--color-surface-alt)] ${isCollapsed ? 'hidden' : 'flex'}`}>
              <span className="text-xs text-[var(--color-text-secondary)] select-none">
                Job Mode {jobMode === 'job' ? '(ON)' : '(OFF)'}
              </span>
              <button
                className={`toggle-track ${jobMode === 'job' ? 'active' : ''}`}
                onClick={onToggleJobMode}
                title={jobMode === 'job' ? 'Job mode: ON — showing job cards' : 'Job mode: OFF — career chat only'}
                aria-label="Toggle job mode"
              >
                <div className="toggle-knob" />
              </button>
            </div>
          </div>

          <hr className={`border-t border-[var(--color-border)] border-0 ${isCollapsed ? 'hidden' : 'block'}`} />

          {/* Personalization Section */}
          <div className={isCollapsed ? 'hidden' : 'block'}>
            <button
              type="button"
              onClick={() => setIsPersonalizationOpen(prev => !prev)}
              className="w-full flex items-center justify-between gap-1.5 text-xs font-medium text-[var(--color-text-primary)] mb-2 border-0 bg-transparent cursor-pointer p-0"
            >
              <span className="flex items-center gap-1.5">
                <UserCircle2 size={14} />
                <span>Personalization</span>
              </span>
              <ChevronDown
                size={14}
                className="text-[var(--color-text-secondary)] transition-transform duration-300"
                style={{ transform: isPersonalizationOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>
            {/* Collapsible body */}
            <div
              style={{
                overflow: 'hidden',
                maxHeight: isPersonalizationOpen ? '1000px' : '0px',
                opacity: isPersonalizationOpen ? 1 : 0,
                transition: 'max-height 0.35s ease, opacity 0.25s ease',
              }}
            >
            <p className="text-[11px] text-[var(--color-text-secondary)] mb-4 leading-relaxed">
              Personalize your job search. The more you add, the better the AI can match you with the right roles.
            </p>

          <form id="personalization-form" onSubmit={handleSubmit} className="space-y-4">
            
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

            {/* Degree/Qualification */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Degree / Qualification</label>
              <div className="flex gap-2">
                <select
                  value={formData.degreeLevel}
                  onChange={e => setFormData({ ...formData, degreeLevel: e.target.value })}
                  className="w-1/3 text-xs border border-[var(--color-border)] rounded-lg px-2 py-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
                >
                  <option value="">Level...</option>
                  {DEGREE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="e.g. B.Tech in CS, MBA"
                  value={formData.degree}
                  onChange={e => setFormData({ ...formData, degree: e.target.value })}
                  className="w-2/3 text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-transparent text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-default"
                />
              </div>
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

            {/* Resume Upload */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Resume / CV</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isUploading}
                />
                <div className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[var(--color-border)] rounded-xl text-sm transition-default
                  ${formData.resumeText ? 'bg-[var(--color-surface-alt)] border-solid border-transparent' : 'hover:border-[var(--color-accent)] bg-[var(--color-surface)]'}
                `}>
                  {isUploading ? (
                    <div className="typing-dot w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                  ) : formData.resumeText ? (
                    <>
                      <CheckCircle2 size={16} className="text-green-500" />
                      <span className="text-[var(--color-text-secondary)] font-medium">Resume Uploaded</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} className="text-[var(--color-text-secondary)]" />
                      <span className="text-[var(--color-text-secondary)] font-medium">Upload PDF</span>
                    </>
                  )}
                </div>
              </div>
            </div>

          </form>
            </div>{/* end collapsible body */}
          </div>

<hr className={`border-t border-[var(--color-border)] border-0 ${isCollapsed ? 'hidden' : 'block'}`} />
          
          {/* Recent Chats Section */}
          <div className={isCollapsed ? 'hidden' : 'block'}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-primary)]">
                <History size={14} />
                <span>Recent Chats</span>
              </div>
              <button 
                onClick={onNewChat}
                className="flex items-center gap-1 px-2 py-1 bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-default rounded-md text-xs cursor-pointer border-0"
              >
                <SquarePen size={12} />
                New Chat
              </button>
            </div>
            
            <div className="flex flex-col gap-1">
              {sessions.length === 0 ? (
                <p className="text-[11px] text-[var(--color-text-tertiary)] italic">No recent chats.</p>
              ) : (
                sessions.map(session => (
                  <div key={session.id} className="relative group">
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className={`flex items-center gap-2 px-3 py-2 text-left text-xs rounded-lg border-0 cursor-pointer transition-default w-full ${
                        activeSessionId === session.id 
                          ? 'bg-[var(--color-accent)] text-white pr-8' 
                          : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-primary)] pr-8'
                      }`}
                    >
                      <MessageSquare size={14} className="shrink-0" />
                      <span className="truncate">{session.title}</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md border-0 bg-transparent cursor-pointer transition-opacity ${
                        activeSessionId === session.id
                          ? 'text-white/70 hover:text-white hover:bg-black/20 opacity-100'
                          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 opacity-0 group-hover:opacity-100'
                      }`}
                      title="Delete chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          
        </div>

        {/* Footer / Save */}
        <div className={`p-4 border-t border-[var(--color-border)] ${isCollapsed ? 'hidden' : 'block'}`}>
          <button
            form="personalization-form"
            type="submit"
            className="w-full py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium transition-default hover:bg-[var(--color-accent-light)] border-0 cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </>
  );
}
