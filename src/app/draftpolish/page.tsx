'use client';

import { useState, useRef, useEffect } from 'react';
import Turnstile from '@/components/Turnstile';

type Mode = 'Standard' | 'Academic' | 'Creative';

export default function DraftPolish() {
  const [mode, setMode] = useState<Mode>('Standard');
  const [text, setText] = useState('');
  const [polishedText, setPolishedText] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mobile tab state: 'input' | 'output'
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');

  // Paywall modal state for 429 interception
  const [showLimitModal, setShowLimitModal] = useState(false);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const affiliateLink = process.env.NEXT_PUBLIC_AFFILIATE_LINK || '#';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const exceedsLimit = wordCount > 500;
  const needsTurnstile = wordCount > 300;

  // Reset token when text drops below threshold
  useEffect(() => {
    if (wordCount <= 300 && turnstileToken) {
      setTurnstileToken('');
    }
  }, [wordCount, turnstileToken]);

  // Track text changes - only reset tab on actual content addition (not cursor movements)
  const prevTextLenRef = useRef(0);
  useEffect(() => {
    if (text.length > prevTextLenRef.current) {
      // Content was added - reset to input tab
      setActiveTab('input');
    }
    prevTextLenRef.current = text.length;
  }, [text]);

  const handleVerify = (token: string) => {
    setTurnstileToken(token);
  };

  const handlePolish = async () => {
    if (!text.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsPolishing(true);
    setPolishedText('');
    setShowLimitModal(false);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode, turnstileToken }),
        signal: abortControllerRef.current.signal
      });

      // TASK B: Intercept 429 for monetization paywall
      if (response.status === 429) {
        setShowLimitModal(true);
        setIsPolishing(false);
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Polish failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setPolishedText(prev => prev + parsed.content);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore abort errors
      } else {
        console.error('Polish error:', error);
        setPolishedText('');
      }
    } finally {
      setIsPolishing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
  };

  const openAffiliate = () => {
    window.open(affiliateLink, '_blank');
  };

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white pb-safe flex flex-col p-4 md:p-12 gap-8 transition-all duration-300">
      {/* TASK B: 429 Paywall Modal */}
      {showLimitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            {/* Shimmer animation element */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="shimmer-line" />
            </div>

            <div className="relative text-center space-y-6">
              <div className="text-5xl">🔒</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Daily Limit Reached
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                You've exhausted your free refinement tokens. Upgrade to our partner's Pro Engine for unlimited enterprise-grade organic reconstruction.
              </p>
              <button
                onClick={openAffiliate}
                className="w-full bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-100 text-white dark:text-black py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity relative overflow-hidden"
              >
                Unlock Pro Humanizer
              </button>
              <button
                onClick={() => setShowLimitModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
              >
                Continue with limited version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TASK A: Advanced Loading Overlay */}
      {isPolishing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
                <div className="absolute inset-2 border-4 border-t-gray-300 dark:border-t-gray-600 rounded-full animate-spin-reverse" />
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">Reconstructing flow...</p>
                <p className="text-xs text-gray-500 mt-1">Applying organic humanization patterns</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 flex-1 pt-4 md:pt-0 pb-32 md:pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-900">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Draft Polish</h1>
            <p className="text-sm text-gray-500">Refine your writing with AI.</p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-full flex gap-1 shadow-sm">
            {(['Standard', 'Academic', 'Creative'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  mode === m
                    ? 'bg-white dark:bg-black shadow-sm text-black dark:text-white'
                    : 'text-gray-500 hover:text-black dark:hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* TASK A: Mobile Tabs - only visible on mobile */}
        <div className="md:hidden flex gap-4 border-b border-gray-100 dark:border-gray-900">
          <button
            onClick={() => setActiveTab('input')}
            className={`pb-3 text-sm font-medium transition-all duration-300 border-b-2 flex-1 text-center ${
              activeTab === 'input'
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-gray-400'
            }`}
          >
            Draft Input
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`pb-3 text-sm font-medium transition-all duration-300 border-b-2 flex-1 text-center ${
              activeTab === 'output'
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-gray-400'
            }`}
          >
            Refined Output
          </button>
        </div>

        {/* TASK A: Core Workspace - Split on desktop, Tabbed on mobile */}
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[50vh] md:min-h-[60vh]">
          {/* Left Column - Original - Hidden on mobile when output tab active */}
          <div className={`flex-1 flex flex-col ${activeTab === 'output' ? 'hidden md:flex' : 'flex'}`}>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium md:hidden">
              Draft Input
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write or paste your original draft here..."
              className="flex-1 w-full p-5 bg-transparent border border-gray-200 dark:border-gray-800 rounded-2xl resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all duration-300 text-base shadow-sm"
            />
          </div>

          {/* Right Column - Polished - Hidden on mobile when input tab active */}
          <div className={`flex-1 flex flex-col ${activeTab === 'input' ? 'hidden md:flex' : 'flex'}`}>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium md:hidden">
              Refined Output
            </div>
            <div className="flex-1 w-full p-5 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-y-auto text-base shadow-sm transition-all duration-300">
              {polishedText ? (
                <div className="whitespace-pre-wrap">{polishedText}</div>
              ) : (
                <div className="h-full flex items-center justify-center opacity-30 text-sm">
                  {isPolishing ? 'Reconstructing flow...' : 'Refined result will appear here.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop: char counter inline */}
        <div className="hidden md:block text-right text-sm text-gray-400 font-mono">
          {wordCount}/500
        </div>
      </div>

      {/* TASK A: Sticky Bottom Action Bar - Glassmorphism on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:relative md:z-auto md:mt-4 bg-white/80 md:bg-transparent dark:bg-black/80 md:dark:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-t border-gray-200 dark:border-gray-800 md:border-0">
        <div className="max-w-6xl mx-auto p-4 md:p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Mobile: Turnstile inline in action bar */}
          <div className="w-full md:w-auto flex items-center gap-4">
            {wordCount > 300 && !turnstileToken && turnstileSiteKey && (
              <div className="flex-1 md:flex-none">
                <Turnstile siteKey={turnstileSiteKey} onVerify={handleVerify} />
              </div>
            )}

            {/* Mobile: char counter */}
            <div className="md:hidden text-sm text-gray-400 font-mono">
              {wordCount}/500
            </div>
          </div>

          {/* Exceeds limit warning */}
          {exceedsLimit && (
            <div className="text-red-500 text-sm text-center md:hidden">
              ⚠️ Exceeds 500 word limit
            </div>
          )}

          <button
            onClick={handlePolish}
            disabled={isPolishing || !text.trim() || exceedsLimit || (needsTurnstile && !turnstileToken)}
            className="w-full sm:w-auto bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPolishing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                <span>Refining...</span>
              </>
            ) : (
              'Polish Text'
            )}
          </button>
        </div>
      </div>

      {/* Loading overlay styles */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .shimmer-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
          animation: shimmer 1.5s infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 1s linear infinite;
        }
      `}</style>
    </main>
  );
}