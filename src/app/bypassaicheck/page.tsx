'use client';

import { useState, useEffect } from 'react';
import Turnstile from '@/components/Turnstile';

interface CheckResult {
  humanScore: number;
  lexical: number;
  structural: number;
  tone: number;
  logic: number;
  rhythm: number;
  punctuation: number;
}

export default function BypassAICheck() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const affiliateLink = process.env.NEXT_PUBLIC_AFFILIATE_LINK || '#';
  const needsTurnstile = Boolean(turnstileSiteKey) && text.length > 300;
  const needsToken = needsTurnstile && !turnstileToken;

  const handleVerify = (token: string) => {
    setTurnstileToken(token);
  };

  const handleCheck = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError('');
    setShowResults(false);
    setShowModal(false);
    setShowBanner(false);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, turnstileToken })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Check failed');
      }

      setResult(data);
      setShowResults(true);

      // Show warning if humanScore < 40
      if (data.humanScore < 40) {
        setShowBanner(true);
        setShowModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const openAffiliateLink = () => {
    window.open(affiliateLink, '_blank');
  };

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white pb-safe flex flex-col items-center justify-center p-6 gap-8 transition-all duration-300">
      {/* Warning Banner */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-3 px-6 text-center text-sm font-medium shadow-lg">
          ⚠️ Warning: Strict AI patterns detected. Free refinement may not bypass strict detectors.
        </div>
      )}

      {/* Modal */}
      {showModal && result && result.humanScore < 40 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <div className="text-center space-y-6">
              <div className="text-5xl">🚨</div>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">AI Detection Alert</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Warning: Strict AI patterns detected. Your text has only <span className="font-bold text-red-600">{result.humanScore}%</span> human score.
              </p>
              <p className="text-sm text-gray-500">
                Free refinement tools may not be enough to bypass Turnitin and other strict detectors.
              </p>
              <button
                onClick={openAffiliateLink}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity"
              >
                Unlock Pro Engine (100% Bypass)
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
              >
                Continue with free version
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl flex flex-col gap-6 flex-1 pt-12 md:pt-24 pb-24">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">AI Content Detector</h1>
          <p className="text-gray-500 dark:text-gray-400">Paste your text below to check for AI generation.</p>
        </div>

        <div className="relative w-full">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text here..."
            className="w-full min-h-[60vh] p-6 bg-transparent border border-gray-200 dark:border-gray-800 rounded-2xl resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all duration-300 text-lg shadow-sm"
          />
          <div className="absolute bottom-4 right-6 text-sm text-gray-400 font-mono">
            {text.length}/2000
          </div>
        </div>

        {/* Turnstile widget - shown when text > 300 chars and no token */}
        {text.length > 300 && !turnstileToken && turnstileSiteKey && (
          <div className="flex justify-center">
            <Turnstile siteKey={turnstileSiteKey} onVerify={handleVerify} />
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm text-center">{error}</div>
        )}

        <button
          onClick={handleCheck}
          disabled={isLoading || needsToken}
          className="w-full md:w-auto md:self-end bg-black text-white dark:bg-white dark:text-black px-8 py-4 rounded-full font-medium shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
          ) : (
            'Check for AI'
          )}
        </button>

        {/* Results Dashboard */}
        {showResults && result && (
          <div className="overflow-hidden transition-all duration-500 ease-in-out max-h-[1000px] opacity-100 mt-8">
            <div className="p-8 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm flex flex-col gap-8 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
              {/* Human Score */}
              <div className="flex flex-col items-center justify-center gap-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Human Score</h3>
                <div className="relative w-48 h-24 overflow-hidden flex items-end justify-center">
                  <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-gray-100 dark:border-gray-900 border-b-transparent border-r-transparent rotate-45 transition-all duration-1000" />
                  <div
                    className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-black dark:border-white border-b-transparent border-r-transparent -rotate-45 transition-all duration-1000"
                    style={{ transform: `rotate(${-135 + (result.humanScore * 2.7)}deg)` }}
                  />
                  <span className="text-4xl font-bold mb-2">{result.humanScore}%</span>
                </div>
              </div>

              {/* Six Dimensions */}
              <div className="space-y-6">
                <Dimension label="Lexical Fingerprint" value={result.lexical} />
                <Dimension label="Structural Pattern" value={result.structural} />
                <Dimension label="Tone Consistency" value={result.tone} />
                <Dimension label="Logic Flow" value={result.logic} />
                <Dimension label="Rhythm Variation" value={result.rhythm} />
                <Dimension label="Punctuation Style" value={result.punctuation} />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Dimension({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-gray-500">{value}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-black dark:bg-white rounded-full transition-all duration-1000"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}