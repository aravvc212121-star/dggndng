import { supabase } from './supabaseClient';

const API_BASE = '/api';

async function getAuthHeaders() {
  if (!supabase) return { 'Content-Type': 'application/json' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };
    }
  } catch {
    // Auth failed, continue without token
  }
  return { 'Content-Type': 'application/json' };
}

// ─── Client-side instant fallback responses ───
// These fire IMMEDIATELY if the server is slow/down, so the user is NEVER stuck loading.

const GREETING_RESPONSES = [
  "hey there! 👋 i'm jobsy, your career assistant. tell me what kind of job you're looking for and i'll find it for you!",
  "hi! 😊 i'm here to help you find your next job. just tell me what role you're interested in!",
  "hello! 🚀 ready to find your dream job? tell me what you're looking for — role, company, location — anything!",
];

const JOB_SEARCH_RESPONSES = [
  "let me search for those roles for you! 🔍",
  "searching for matching jobs now! ⚡",
  "on it! let me find the best matches for you 🎯",
];

const CAREER_ADVICE_RESPONSES = [
  "great question! 💡 here's what i'd suggest:\n\n- **Build projects** — real-world projects beat certificates every time\n- **Network actively** — connect with people in your target role on LinkedIn\n- **Tailor your resume** — customize it for each application\n- **Practice interviews** — use the STAR method for behavioral questions\n\nwant me to dive deeper into any of these?",
  "here's my career advice! 🚀\n\n- **Focus on skills in demand** — check job postings for the most requested skills\n- **Get certifications** — AWS, Google, or industry-specific ones add credibility\n- **Build an online presence** — GitHub, portfolio site, LinkedIn\n- **Start applying early** — don't wait until you feel \"ready\"\n\nwant me to help with something specific?",
];

const FALLBACK_RESPONSE = {
  message: "i'm here to help! 😊 i can find jobs for you, review your resume, or give career advice. what would you like to do?",
  suggestions: ['find me a job', 'review my resume', 'career advice', 'interview tips'],
};

function getInstantFallback(userMessage) {
  const lower = (userMessage || '').toLowerCase().trim();

  // Greetings
  if (/^(hi|hey|hello|sup|yo|good morning|good evening|howdy|what'?s up|hola)/i.test(lower)) {
    return {
      message: GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)],
      suggestions: ['react developer jobs', 'remote backend engineer', 'data science fresher roles', 'ML engineer internship'],
    };
  }

  // Job search intent
  if (/\b(find|search|show|looking for|jobs?|roles?|openings?|hiring|remote|developer|engineer|analyst|intern|fresher|manager|designer|devops|fullstack|frontend|backend|data scientist|ml engineer)\b/i.test(lower)) {
    return {
      message: JOB_SEARCH_RESPONSES[Math.floor(Math.random() * JOB_SEARCH_RESPONSES.length)],
      suggestions: ['show me more', 'try different keywords', 'remote only'],
      _isJobSearch: true, // flag for the caller to know this was a job search
    };
  }

  // Career advice
  if (/\b(career|advice|roadmap|how to become|skill|learn|transition|switch|upskill|guide|tips|coaching|mentor|portfolio)\b/i.test(lower)) {
    return {
      message: CAREER_ADVICE_RESPONSES[Math.floor(Math.random() * CAREER_ADVICE_RESPONSES.length)],
      suggestions: ['find related jobs', 'resume tips', 'interview prep', 'salary negotiation'],
    };
  }

  // Resume
  if (/\b(resume|cv|cover letter|portfolio)\b/i.test(lower)) {
    return {
      message: "i'd love to help with your resume! 📝 you can upload it using the + button and i'll review it for you. or ask me for resume tips!",
      suggestions: ['resume tips', 'how to write a cover letter', 'find jobs matching my skills'],
    };
  }

  // Interview
  if (/\b(interview|mock|prepare|behavioral|technical|coding round)\b/i.test(lower)) {
    return {
      message: "let's get you interview-ready! 🎯\n\n- **Behavioral**: use the STAR method (Situation, Task, Action, Result)\n- **Technical**: practice on LeetCode/HackerRank for coding rounds\n- **Research**: know the company's products, culture, and recent news\n- **Questions**: always have 2-3 thoughtful questions for the interviewer\n\nwant me to do a mock interview with you?",
      suggestions: ['mock interview', 'common interview questions', 'salary negotiation tips'],
    };
  }

  // Default
  return FALLBACK_RESPONSE;
}

// Full conversational chat — with AGGRESSIVE multi-fallback
// Layer 1: Server call with 8s timeout (fast path)
// Layer 2: Quick retry with 5s timeout
// Layer 3: Instant client-side fallback (always works, no server needed)
export async function chat(userMessage, conversationHistory, profile, personalization, jobMode) {
  // Layer 1: Fast server call (8s timeout)
  try {
    const result = await fetchChatWithTimeout(userMessage, conversationHistory, profile, personalization, jobMode, 8000);
    if (result && result.message) return result;
  } catch {
    // Layer 1 failed — try layer 2
  }

  // Layer 2: Quick retry (5s timeout, server might have recovered)
  try {
    const result = await fetchChatWithTimeout(userMessage, conversationHistory, profile, personalization, jobMode, 5000);
    if (result && result.message) return result;
  } catch {
    // Layer 2 failed — use layer 3
  }

  // Layer 3: INSTANT client-side fallback (always works)
  console.log('[Jobsy] Server unavailable — using instant fallback');
  return getInstantFallback(userMessage);
}

async function fetchChatWithTimeout(userMessage, conversationHistory, profile, personalization, jobMode, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: userMessage,
        history: conversationHistory.slice(-10),
        profile: profile || null,
        personalization: personalization || null,
        jobMode: jobMode || 'job',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // Server returned an error status — throw to trigger fallback
      throw new Error(`Server error: ${res.status}`);
    }

    const data = await res.json();
    // Validate the response has actual content
    if (!data || (!data.message && !data.jobs)) {
      throw new Error('Empty response from server');
    }
    return data;
  } catch (error) {
    clearTimeout(timer);
    throw error; // propagate to trigger next fallback layer
  }
}

// Parse resume PDF text into structured profile
export async function parseResume(resumeText) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/parse-resume`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ resumeText }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('Failed to parse resume');
    return res.json();
  } catch (error) {
    clearTimeout(timer);
    // Fallback: return a basic structure so the app doesn't break
    if (error.name === 'AbortError') {
      return {
        name: '',
        email: '',
        summary: 'Resume parsing timed out. Please try again.',
        skills: [],
        experienceYears: 0,
        education: '',
        pastRoles: [],
      };
    }
    throw error;
  }
}

// Roast a resume
export async function roastResume(resumeText) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/roast-resume`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ resumeText }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('Failed to roast resume');
    return res.json();
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      return { roast: "Server took too long to roast your resume! Try again in a moment. 🔥" };
    }
    throw error;
  }
}

// Fetch personalized "For You" job feed
export async function fetchForYou(personalization, profile) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/for-you`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ personalization, profile }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return res.json();
  } catch (error) {
    clearTimeout(timer);
    return { jobs: [], incomplete: true };
  }
}

// Analyze skill gap between user's skills and a job's requirements
export async function analyzeSkillGap(userSkills, job) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/skill-gap`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userSkills, job }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('Failed to analyze skill gap');
    return res.json();
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      return {
        matchPercent: 0,
        matchedSkills: [],
        missingSkills: [],
        suggestions: ['Server was slow — try again for a detailed analysis.'],
      };
    }
    throw error;
  }
}

export async function saveChatMessage(role, content, mode) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/chat/save-message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ role, content, mode }),
    });
    if (!res.ok) throw new Error('Failed to save message');
    return res.json();
  } catch {
    // Non-critical — silently fail
    return { success: false };
  }
}

export async function getChatHistory() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/chat/history`, {
      headers,
    });
    if (!res.ok) {
      if (res.status === 401) return null;
      throw new Error('Failed to fetch chat history');
    }
    const data = await res.json();
    return data.messages || [];
  } catch {
    return [];
  }
}

export async function deleteAccount() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/delete-account`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete account');
  return res.json();
}
