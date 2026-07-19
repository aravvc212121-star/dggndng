import { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Plus, X, FileText } from 'lucide-react';
import JobCard from './JobCard';
import FollowButton from './FollowButton';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]" />
      <div className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]" />
      <div className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)]" />
    </div>
  );
}

// Professional markdown renderer for career coaching roadmaps
function FormattedText({ text }) {
  if (!text) return null;
  
  const lines = text.split('\n');
  return (
    <div className="formatted-roadmap text-[14.5px] leading-[1.65] text-[#2c2c30]">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-3" />; // Enhanced spacing for empty lines
        
        // Bullet points
        if (/^[-•]\s/.test(trimmed)) {
          const content = trimmed.replace(/^[-•]\s*/, '');
          return (
            <div key={i} className="flex items-start gap-2.5 pl-1 mb-2.5">
              <span className="text-[var(--color-accent)] mt-[1px] shrink-0 opacity-80 text-[18px] leading-none">•</span>
              <span className="flex-1" dangerouslySetInnerHTML={{ __html: renderInline(content) }} />
            </div>
          );
        }

        // Numbered list items
        if (/^\d+\.\s/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s/);
          const num = numMatch ? numMatch[1] : '';
          const content = trimmed.replace(/^\d+\.\s*/, '');
          return (
            <div key={i} className="flex items-start gap-2 pl-1 mb-2.5">
              <span className="text-[var(--color-text-secondary)] font-medium shrink-0">{num}</span>
              <span className="flex-1" dangerouslySetInnerHTML={{ __html: renderInline(content) }} />
            </div>
          );
        }
        
        // Bold-only line (likely a header)
        if (/^\*\*[^*]+\*\*\s*$/.test(trimmed)) {
          const headerText = trimmed.replace(/\*\*/g, '');
          return (
            <h4 key={i} className="font-semibold text-[15px] text-[#111] mt-5 mb-2 tracking-tight">
              {headerText}
            </h4>
          );
        }
        
        // Regular line with possible inline bold
        return (
          <p key={i} className="mb-3.5 last:mb-0" dangerouslySetInnerHTML={{ __html: renderInline(trimmed) }} />
        );
      })}
    </div>
  );
}

function renderInline(text) {
  // Convert **bold** to <strong> with better contrast
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-[#111]">$1</strong>');
}

function SuggestionChips({ suggestions, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 mt-4 w-full max-w-sm mx-auto">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="px-3 py-2 text-xs rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] bg-[var(--color-surface)] transition-default cursor-pointer leading-tight text-center flex items-center justify-center min-h-[44px]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function AnimatedText({ text, isNew }) {
  const [displayedText, setDisplayedText] = useState(isNew ? '' : text);

  useEffect(() => {
    if (!isNew || !text) {
      setDisplayedText(text || '');
      return;
    }
    
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 3));
      i += 3;
      if (i >= text.length) {
        setDisplayedText(text);
        clearInterval(interval);
      }
    }, 15);
    
    return () => clearInterval(interval);
  }, [text, isNew]);

  return <FormattedText text={displayedText} />;
}

export default function ChatPanel({ messages, onSend, isLoading, onApplied }) {
  const [initialCount] = useState(messages.length);
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    setAttachedFile(null);
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      // Accept common resume formats
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (validTypes.includes(file.type)) {
        setAttachedFile(file);
        // Pre-fill input with a helpful message if empty
        if (!input.trim()) {
          setInput('Review my resume and suggest relevant jobs');
        }
      } else {
        alert('Please upload a valid resume file (PDF, DOC, DOCX, or TXT)');
      }
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  }

  function handleRemoveAttachment() {
    setAttachedFile(null);
  }

  return (
    <div className="flex flex-col h-full" id="chat-panel">
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 pt-16 md:pt-4 pb-[80px] md:pb-4 space-y-4 min-h-0"
        onScroll={e => window.dispatchEvent(new CustomEvent('chatScroll', { detail: { scrollTop: e.currentTarget.scrollTop } }))}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shrink-0 overflow-hidden shadow-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
              <img src="/jobsy-logo.png" alt="Jobsy" className="w-full h-full object-contain p-2" />
            </div>
            <h2 className="text-base font-medium text-[var(--color-text-primary)] m-0 mb-1">
              what are you looking for?
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] m-0 max-w-xs mb-4">
              try something like "data science roles at Deloitte for freshers" or "remote react developer jobs"
            </p>
            <SuggestionChips
              suggestions={[
                'react developer jobs',
                'data science fresher roles',
                'remote backend engineer',
                'ML engineer internship',
              ]}
              onSelect={onSend}
            />
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="animate-fade-in">
            {/* User messages */}
            {msg.role === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed bg-[var(--color-accent)] text-white rounded-br-md">
                  {msg.content}
                </div>
              </div>
            )}

            {/* Assistant text-only messages */}
            {msg.role === 'assistant' && !msg.jobs && (
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="px-1 py-1.5 text-sm leading-relaxed text-[var(--color-text-primary)]">
                    <AnimatedText text={msg.content} isNew={i >= initialCount} />
                  </div>
                  {msg.suggestions && (
                    <SuggestionChips suggestions={msg.suggestions} onSelect={onSend} />
                  )}
                </div>
              </div>
            )}

            {/* Assistant message with inline job cards in grid */}
            {msg.role === 'assistant' && msg.jobs && (
              <div className="flex justify-start">
                <div className="w-full">
                  {msg.content && (
                    <div className="px-1 py-1.5 text-sm leading-relaxed text-[var(--color-text-primary)] mb-2 inline-block">
                      <AnimatedText text={msg.content} isNew={i >= initialCount} />
                    </div>
                  )}
                  {/* Company follow card if company search */}
                  {msg.searchFilters?.company && (!msg.searchFilters?.role || msg.searchFilters.role.trim() === '') && (
                    <div className="mb-3 mt-1 flex items-center justify-between p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium text-[var(--color-text-secondary)] uppercase">
                            {msg.searchFilters.company.substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-[var(--color-text-primary)] m-0">{msg.searchFilters.company}</h3>
                          <p className="text-[11px] text-[var(--color-text-tertiary)] m-0 mt-0.5">
                            {msg.jobs.length} {msg.jobs.length === 1 ? 'opening' : 'openings'} · {
                              (() => {
                                const locs = [...new Set(msg.jobs.map(j => j.location))].filter(Boolean);
                                return locs.length > 2 ? 'Multiple locs' : locs.join(', ') || 'Remote';
                              })()
                            }
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 ml-2">
                        <FollowButton company={msg.searchFilters.company} variant="card" />
                      </div>
                    </div>
                  )}
                  {/* Job cards in a 2-col (mobile) / 3-col (desktop) grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                    {msg.jobs.map((job, j) => (
                      <JobCard
                        key={job.applyLink || j}
                        job={job}
                        compact={true}
                        onApplied={onApplied}
                      />
                    ))}
                  </div>
                  {/* Follow-up message after jobs */}
                  {msg.followUp && (
                    <div className="mt-2 px-1 py-1.5 text-sm leading-relaxed text-[var(--color-text-primary)] inline-block">
                      <AnimatedText text={msg.followUp} isNew={i >= initialCount} />
                    </div>
                  )}
                  {msg.suggestions && (
                    <SuggestionChips suggestions={msg.suggestions} onSelect={onSend} />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface-alt)] rounded-xl rounded-bl-md">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Top fade — mirrors the bottom fade, fades content behind floating pills */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-[80px] bg-gradient-to-b from-[var(--color-surface)] from-[20px] to-transparent pointer-events-none z-30" />

      {/* Background mask to hide scrolling text. Fade happens entirely BEHIND the search pill (h-130px) so it's invisible above it. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-gradient-to-t from-[var(--color-surface)] from-[40px] to-transparent pointer-events-none z-30" />

      {/* Input bar — floating pill style on mobile */}
      <div 
        id="chat-input-wrapper"
        className="fixed md:static bottom-2 md:bottom-auto left-2 right-2 md:left-auto md:right-auto md:px-4 md:pb-4 md:pt-2 z-40 transition-all duration-300 pointer-events-none md:pointer-events-auto"
      >
        <form
          id="chat-input-form"
          onSubmit={handleSubmit}
          className="w-full max-w-3xl mx-auto pointer-events-auto"
        >
          {/* Attached file preview */}
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg mx-2 md:mx-0">
              <FileText size={16} className="text-[var(--color-accent)] shrink-0" />
              <span className="text-xs text-[var(--color-text-primary)] flex-1 truncate">
                {attachedFile.name}
              </span>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="p-1 rounded-full border-0 cursor-pointer text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-default shrink-0 flex items-center justify-center"
                title="Remove file"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {/* Attach button - separate circle */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload resume"
            />
            <button
              type="button"
              onClick={handleAttachClick}
              className="p-1.5 rounded-full border-0 cursor-pointer text-white hover:bg-gray-800 transition-default shrink-0 flex items-center justify-center bg-black shadow-sm"
              title="Attach resume"
              disabled={isLoading}
            >
              <Plus size={22} strokeWidth={1.5} />
            </button>
            
            {/* Search input bar */}
            <div className="flex-1 flex items-center gap-2 border border-[var(--color-border)] rounded-full px-4 py-1.5 focus-within:border-[var(--color-accent)] focus-within:shadow-md transition-all duration-300 bg-[var(--color-surface)]/90 backdrop-blur-xl shadow-sm">
              <input
                ref={inputRef}
                type="search"
                name="chat-input"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                inputMode="search"
                spellCheck="true"
                autoCorrect="on"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="describe the job you're looking for..."
                className="flex-1 bg-transparent border-0 outline-none text-[13px] font-light text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-1.5 rounded-full border-0 cursor-pointer transition-default shrink-0 bg-black text-white"
              >
                <SendHorizontal size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
