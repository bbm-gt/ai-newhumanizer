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

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  const handleVerify = (token: string) => {
    setTurnstileToken(token);
  };

  const handlePolish = async () => {
    if (!text.trim()) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsPolishing(true);
    setPolishedText('');
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode, turnstileToken }),
        signal: abortControllerRef.current.signal
      });

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

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white pb-safe flex flex-col p-6 gap-8 transition-all duration-300">
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 flex-1 pt-6 md:pt-12 pb-24">
        {/* Top Control */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-gray-100 dark:border-gray-900">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Draft Polish</h1>
            <p className="text-sm text-gray-500">Refine your writing with AI.</p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-full flex gap-1 shadow-sm">
            {(['Standard', 'Academic', 'Creative'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
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

        {/* Mobile Tabs */}
        <div className="md:hidden flex gap-4 border-b border-gray-100 dark:border-gray-900">
          <button
            onClick={() => {}}
            className={`pb-3 text-sm font-medium transition-all duration-300 border-b-2 flex-1 text-center border-black dark:border-white text-black dark:text-white`}
          >
            Original
          </button>
          <button
            onClick={() => {}}
            className={`pb-3 text-sm font-medium transition-all duration-300 border-b-2 flex-1 text-center border-transparent text-gray-400`}
          >
            Polished
          </button>
        </div>

        {/* Core Workspace */}
        <div className="flex-1 flex flex-col md:flex-row gap-8 min-h-[60vh]">
          {/* Left Column - Original */}
          <div className="flex-1 flex flex-col">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write or paste your original draft here..."
              className="flex-1 w-full p-6 bg-transparent border border-gray-200 dark:border-gray-800 rounded-3xl resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all duration-300 text-lg shadow-sm"
            />
          </div>

          {/* Right Column - Polished */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 w-full p-6 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-y-auto text-lg shadow-sm transition-all duration-300">
              {polishedText || isPolishing ? (
                <div className="whitespace-pre-wrap">{polishedText}</div>
              ) : (
                <div className="h-full flex items-center justify-center opacity-30 text-sm">
                  {isPolishing ? 'Polishing...' : 'Polished result will appear here.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Turnstile - shown when text > 300 chars */}
          {text.length > 300 && !turnstileToken && turnstileSiteKey && (
            <div className="flex justify-center">
              <Turnstile siteKey={turnstileSiteKey} onVerify={handleVerify} />
            </div>
          )}

          {/* Reminder when text exceeds 600 chars */}
          {text.length > 600 && (
            <div className="text-amber-500 text-sm text-center">
              ⚠️ Text exceeds 600 characters
            </div>
          )}

          <button
            onClick={handlePolish}
            disabled={isPolishing || !text.trim()}
            className="w-full sm:w-auto bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-full font-medium shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPolishing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                <span>Polishing...</span>
              </>
            ) : (
              'Polish Text'
            )}
          </button>
        </div>
      </div>
    </main>
  );
}