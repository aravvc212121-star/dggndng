import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader, RefreshCw, ChevronUp, ExternalLink } from 'lucide-react';

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
];

function getPlaceholderGradient(index) {
  return PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
}

function timeAgoLocal(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCategoryFromHeadline(headline) {
  const h = headline.toLowerCase();
  if (/\b(ai|artificial intelligence|machine learning|llm|gpt)\b/.test(h)) return 'AI';
  if (/\b(layoff|layoffs|cut|cuts|fired)\b/.test(h)) return 'Layoffs';
  if (/\b(hire|hiring|jobs|recruit)\b/.test(h)) return 'Hiring';
  if (/\b(startup|funding|seed|series)\b/.test(h)) return 'Startup';
  if (/\b(apple|google|meta|microsoft|amazon|nvidia)\b/.test(h)) return 'Big Tech';
  if (/\b(crypto|bitcoin|web3|blockchain)\b/.test(h)) return 'Crypto';
  return 'Tech';
}

const SEEN_KEY = 'jobpilot_news_seen_ids';
const CACHE_KEY = 'jobpilot_news_cache';
const CACHE_TTL = 10 * 60 * 1000;

function getSeenIds() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function saveSeenIds(ids) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
}
function getCachedNews() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { articles, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return articles;
  } catch { return null; }
}
function setCachedNews(articles) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ articles, timestamp: Date.now() }));
}

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const [pendingArticles, setPendingArticles] = useState([]);
  const [isPulling, setIsPulling] = useState(false);
  const [imgErrors, setImgErrors] = useState(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const feedRef = useRef(null);
  const intervalRef = useRef(null);
  const rafRef = useRef(null);

  const fetchNews = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tech-news');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const fetched = data.articles || [];

      const existingIds = new Set(articles.map(a => a.id));

      if (isBackground && articles.length > 0) {
        const brandNew = fetched.filter(a => !existingIds.has(a.id));
        if (brandNew.length > 0) {
          setPendingArticles(brandNew);
          setNewCount(brandNew.length);
        }
      } else {
        setArticles(fetched);
        setCachedNews(fetched);
        const allIds = [...getSeenIds(), ...fetched.map(a => a.id)];
        saveSeenIds([...new Set(allIds)]);
      }
    } catch (err) {
      if (!isBackground) setError('Could not load news. Check your connection.');
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [articles]);

  useEffect(() => {
    const cached = getCachedNews();
    if (cached && cached.length > 0) {
      setArticles(cached);
      setIsLoading(false);
    }
    fetchNews(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchNews(true);
    }, 30 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [fetchNews]);

  // Scroll Animation Logic
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      const container = feedRef.current;
      if (!container) return;
      
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const center = scrollLeft + containerWidth / 2;
      
      // Update dots
      const newIndex = Math.round(scrollLeft / containerWidth);
      if (newIndex !== currentIndex) setCurrentIndex(newIndex);

      // Dispatch event to shrink the Jobsy pill in App.jsx
      window.dispatchEvent(new CustomEvent('chatScroll', { detail: { scrollTop: scrollLeft } }));

      // Update scale and opacity for each slide
      const slides = container.querySelectorAll('.story-slide');
      slides.forEach((slide) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(center - slideCenter);
        const ratio = Math.min(distance / containerWidth, 1); // 0 (center) to 1 (full width away)
        
        // At center: scale 1, opacity 1
        // At edges (ratio 1): scale 0.85, opacity 0.2
        const scale = 1 - (ratio * 0.15); 
        const opacity = 1 - (ratio * 0.8);
        
        const content = slide.querySelector('.story-content');
        if (content) {
          content.style.transform = `scale(${scale})`;
          content.style.opacity = opacity;
        }
      });
    });
  }, [currentIndex]);

  useEffect(() => {
    const container = feedRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      // Trigger once on mount
      handleScroll();
    }
    return () => {
      if (container) container.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll, articles.length]);

  function handleShowNew() {
    const merged = [...pendingArticles, ...articles];
    const seen = new Set();
    const deduped = merged.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
    deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    setArticles(deduped);
    setCachedNews(deduped);
    saveSeenIds([...new Set([...getSeenIds(), ...deduped.map(a => a.id)])]);
    setPendingArticles([]);
    setNewCount(0);
    setCurrentIndex(0);
    if (feedRef.current) {
      feedRef.current.scrollLeft = 0;
    }
  }

  async function handlePullRefresh() {
    setIsPulling(true);
    await fetchNews(false);
    setNewCount(0);
    setPendingArticles([]);
    setIsPulling(false);
  }

  function handleImageError(articleId) {
    setImgErrors(prev => new Set(prev).add(articleId));
  }

  if (isLoading && articles.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader size={24} className="animate-spin text-[var(--color-accent)]" />
          <p className="text-sm text-[var(--color-text-secondary)] m-0">Loading tech news…</p>
        </div>
      </div>
    );
  }

  if (error && articles.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <p className="text-sm text-[var(--color-text-secondary)] m-0">{error}</p>
          <button
            onClick={() => fetchNews(false)}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium border-0 cursor-pointer transition-default hover:bg-[var(--color-accent-light)]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden bg-[var(--color-surface-alt)]" id="news-page">
      
      {/* Header Area (Static) */}
      <div className="shrink-0 z-50 bg-[var(--color-surface)] border-b border-[var(--color-border)] pb-3">
        {/* Header content */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-base font-medium text-[var(--color-text-primary)] m-0">tech news</h1>
          </div>
          <button
            onClick={handlePullRefresh}
            disabled={isPulling}
            className="p-1.5 rounded-lg border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-tertiary)] cursor-pointer transition-default disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={isPulling ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Progress dashes */}
        <div className="flex items-center justify-center gap-1.5 px-4 mt-1">
          {articles.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 bg-[var(--color-accent)]' : 'w-1.5 bg-[var(--color-border-dark)]'}`}
            />
          ))}
        </div>
      </div>

      {/* New stories pill (Floating) */}
      {newCount > 0 && (
        <div className="absolute top-24 left-0 right-0 flex justify-center z-[60] pointer-events-auto">
          <button
            onClick={handleShowNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-accent)] text-white text-xs font-medium border-0 cursor-pointer shadow-lg animate-fade-in hover:scale-105 transition-transform"
          >
            <ChevronUp size={14} />
            {newCount} new {newCount === 1 ? 'story' : 'stories'} — tap to refresh
          </button>
        </div>
      )}

      {/* Feed (Horizontal Swipe) */}
      <div 
        ref={feedRef} 
        className="flex-1 flex flex-row overflow-x-auto hide-scrollbar snap-x snap-mandatory h-full overscroll-x-contain"
      >
        {articles.map((article, index) => (
          <article
            key={article.id}
            className="story-slide w-full max-w-full shrink-0 basis-full flex-none h-full snap-start flex items-center justify-center bg-[var(--color-surface-alt)] box-border"
          >
            {/* Scaled/Faded content wrapper */}
            <div 
              className="story-content w-full max-w-full h-full flex flex-col bg-[var(--color-surface)] origin-center will-change-transform box-border"
              style={{ transition: 'none' }} // Transition handled by requestAnimationFrame
            >
              {/* Poster image (clickable) */}
              <a 
                href={article.articleUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full max-w-full h-[40%] md:h-[45%] block relative overflow-hidden flex-shrink-0 bg-[var(--color-surface-alt)] no-underline box-border"
              >
                {article.imageUrl && !imgErrors.has(article.id) ? (
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="w-full h-full object-cover block box-border"
                    loading="lazy"
                    onError={() => handleImageError(article.id)}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: getPlaceholderGradient(index) }}
                  >
                    <span className="text-white/30 text-8xl font-bold select-none text-center px-4">
                      {article.headline.substring(0, 3).toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Gradient overlay for text legibility at bottom of poster */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--color-surface)] to-transparent" />
                
                {/* Category Pill */}
                <div className="absolute top-4 left-4 z-10">
                  <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] md:text-xs font-semibold uppercase tracking-wider shadow-sm">
                    {getCategoryFromHeadline(article.headline)}
                  </span>
                </div>
              </a>

              {/* Text content area */}
              <div className="flex-1 w-full max-w-full p-6 md:p-8 flex flex-col justify-start text-left box-border overflow-hidden">
                <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar pb-2">
                  <h2 className="text-[20px] md:text-2xl font-bold text-[var(--color-text-primary)] m-0 mb-2 leading-tight break-words">
                    {article.headline}
                  </h2>
                  
                  <p className="text-[11px] md:text-xs text-[var(--color-text-tertiary)] m-0 mb-3 font-medium uppercase tracking-wide break-words">
                    {article.source} <span className="opacity-60 px-1">•</span> {article.timeAgo || timeAgoLocal(article.publishedAt)}
                  </p>
                  
                  {article.summary && article.summary !== article.headline && (
                    <p className="text-[14px] md:text-[15px] text-[var(--color-text-secondary)] m-0 leading-relaxed break-words">
                      {article.summary}
                    </p>
                  )}
                </div>
                
                <a
                  href={article.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-light)] no-underline transition-default w-fit"
                >
                  Read full article
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
