'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Turnstile from '@/components/Turnstile';
import TextHighlighter, { Sentence } from '@/components/TextHighlighter';

const AIDetectionRadarChart = dynamic(
  () => import('@/components/AIDetectionRadarChart'),
  { ssr: false, loading: () => <div className="h-[350px] flex items-center justify-center text-gray-400">Loading chart...</div> }
);

interface Dimensions {
  lexical: number;
  structural: number;
  rhythm: number;
  tone: number;
  punctuation: number;
  logic: number;
}

interface CheckResult {
  totalAiProbability: number;
  dimensions: Dimensions;
  sentences: Sentence[];
  _fallback?: boolean;
  _error?: string;
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
  const [showLimitModal, setShowLimitModal] = useState(false);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const affiliateLink = process.env.NEXT_PUBLIC_AFFILIATE_LINK || '#';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const needsTurnstile = Boolean(turnstileSiteKey) && wordCount > 300;
  const needsToken = needsTurnstile && !turnstileToken;
  const exceedsLimit = wordCount > 500;

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

      // Intercept 429 for paywall redirect
      if (res.status === 429) {
        setShowLimitModal(true);
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Check failed');
      }

      setResult(data);
      setShowResults(true);

      if (data.totalAiProbability > 50) {
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

  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return 'text-red-600 dark:text-red-400';
    if (prob >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProbabilityLabel = (prob: number) => {
    if (prob >= 70) return 'High AI Probability';
    if (prob >= 40) return 'Moderate AI Probability';
    return 'Low AI Probability';
  };

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white pb-safe flex flex-col items-center justify-center p-4 md:p-12 gap-8 transition-all duration-300">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-gray-900 dark:border-t-white rounded-full animate-spin" />
                <div className="absolute inset-2 border-4 border-t-gray-300 dark:border-t-gray-600 rounded-full animate-spin-reverse" />
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">Analyzing flow...</p>
                <p className="text-xs text-gray-500 mt-1">Running diagnostic patterns</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anxiety Banner - aggressive red alert */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 to-red-500 text-white py-3 px-6 text-center text-sm font-bold shadow-lg animate-pulse">
          ⚠️ High AI probability detected. Refine to human-level with Pro.
        </div>
      )}

      {/* TASK C: Emotional Alert Modal for High Scores (AI > 50) */}
      {showModal && result && result.totalAiProbability > 50 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
        >
          <div className="relative bg-gradient-to-br from-red-600 to-red-500 rounded-3xl p-10 max-w-md w-full shadow-2xl overflow-hidden">
            {/* Red glow effect - behind content using negative z-index */}
            <div className="absolute -inset-1 bg-red-600 blur-xl opacity-50 -z-10" />

            <div className="relative text-center space-y-6">
              {/* Pulsing alert badge */}
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-sm font-medium">AI Detection Alert</span>
              </div>

              <div className="text-6xl">🚨</div>

              <h2 className="text-2xl font-bold text-white">
                High AI Probability Detected
              </h2>

              <p className="text-white/90 text-sm leading-relaxed">
                Your text has a <span className="font-bold text-white">{result.totalAiProbability}%</span> AI probability score. Use our partner's Pro Engine for organic reconstruction that passes strict detectors.
              </p>

              {/* TASK C: Primary CTA dominates - Unlock Pro Humanizer */}
              <button
                onClick={openAffiliateLink}
                className="w-full bg-white text-red-600 py-5 rounded-full font-bold text-lg hover:bg-gray-100 transition-all duration-300 shadow-xl flex items-center justify-center gap-2"
              >
                <span>Unlock Pro Humanizer</span>
                <span className="text-lg">→</span>
              </button>

              {/* TASK C: Secondary button is extremely subtle */}
              <button
                onClick={() => setShowModal(false)}
                className="text-white/50 hover:text-white/80 text-xs font-normal transition-colors"
              >
                Review detailed analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 429 Limit Modal - same style as DraftPolish */}
      {showLimitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="shimmer-line" />
            </div>

            <div className="relative text-center space-y-6">
              <div className="text-5xl">🔒</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Daily Limit Reached
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                You've exhausted your free diagnostic tokens. Upgrade to our partner's Pro Engine for unlimited enterprise-grade organic reconstruction.
              </p>
              <button
                onClick={openAffiliateLink}
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

      <div className="w-full max-w-3xl flex flex-col gap-6 flex-1 pt-16 md:pt-24 pb-28 md:pb-24">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">AI Content Detector</h1>
          <p className="text-gray-500 dark:text-gray-400">Paste your text below to diagnose AI generation patterns.</p>
        </div>

        <div className="relative w-full">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text here for diagnostic analysis..."
            className="w-full min-h-[50vh] md:min-h-[60vh] p-5 md:p-6 bg-transparent border border-gray-200 dark:border-gray-800 rounded-2xl resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all duration-300 text-base md:text-lg shadow-sm"
          />
          <div className="absolute bottom-4 right-6 text-sm text-gray-400 font-mono">
            {wordCount}/500
          </div>
        </div>

        {exceedsLimit && (
          <div className="text-red-500 text-sm text-center">
            ⚠️ Text exceeds 500 word limit.
          </div>
        )}

        {wordCount > 300 && !turnstileToken && turnstileSiteKey && (
          <div className="flex justify-center">
            <Turnstile siteKey={turnstileSiteKey} onVerify={handleVerify} />
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm text-center">{error}</div>
        )}

        <button
          onClick={handleCheck}
          disabled={isLoading || needsToken || exceedsLimit}
          className="w-full md:w-auto md:self-end bg-black text-white dark:bg-white dark:text-black px-8 py-4 rounded-full font-medium shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
          ) : (
            'Run Diagnostic'
          )}
        </button>

        {showResults && result && (
          <div className="overflow-hidden transition-all duration-500 ease-in-out max-h-[2000px] opacity-100 mt-8 space-y-8">
            {/* Fallback Warning Banner */}
            {result._fallback && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Detection degraded: {result._error || 'API unavailable'}. Results may be inaccurate.
              </div>
            )}

            {/* Main Score Card */}
            <div className="p-6 md:p-8 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm flex flex-col gap-6 md:gap-8 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center justify-center gap-4">
                {/* TASK C: Score ring with emotional color gradient */}
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">AI Probability Score</h3>
                <div className="relative w-40 h-24 md:w-48 md:h-24 overflow-hidden flex items-end justify-center">
                  <div className="absolute top-0 left-0 w-40 h-40 md:w-48 md:h-48 rounded-full border-[14px] md:border-[16px] border-gray-100 dark:border-gray-900 border-b-transparent border-r-transparent rotate-45 transition-all duration-1000" />
                  <div
                    className={`absolute top-0 left-0 w-40 h-40 md:w-48 md:h-48 rounded-full border-[14px] md:border-[16px] ${getProbabilityColor(result.totalAiProbability).replace('text-', 'border-')} border-b-transparent border-r-transparent -rotate-45 transition-all duration-1000`}
                    style={{ transform: `rotate(${-135 + (result.totalAiProbability * 2.7)}deg)` }}
                  />
                  <span className={`text-4xl md:text-5xl font-bold mb-2 ${getProbabilityColor(result.totalAiProbability)}`}>
                    {result.totalAiProbability}%
                  </span>
                </div>
                <span className={`text-sm font-semibold ${getProbabilityColor(result.totalAiProbability)}`}>
                  {getProbabilityLabel(result.totalAiProbability)}
                </span>
              </div>

              <AIDetectionRadarChart
                lexical={result.dimensions.lexical}
                structural={result.dimensions.structural}
                tone={result.dimensions.tone}
                logic={result.dimensions.logic}
                rhythm={result.dimensions.rhythm}
                punctuation={result.dimensions.punctuation}
              />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                <DimensionLabel label="Lexical" value={result.dimensions.lexical} />
                <DimensionLabel label="Structural" value={result.dimensions.structural} />
                <DimensionLabel label="Tone" value={result.dimensions.tone} />
                <DimensionLabel label="Logic" value={result.dimensions.logic} />
                <DimensionLabel label="Rhythm" value={result.dimensions.rhythm} />
                <DimensionLabel label="Punctuation" value={result.dimensions.punctuation} />
              </div>

              {/* TASK C: Inline CTA for moderate scores (40-50) */}
              {result.totalAiProbability >= 40 && result.totalAiProbability <= 50 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Borderline detected
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                        Consider refinement for stricter detectors
                      </p>
                    </div>
                    <button
                      onClick={openAffiliateLink}
                      className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-full hover:bg-yellow-600 transition-colors"
                    >
                      Refine to Human-Level
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* White-box Highlighter */}
            {result.sentences && result.sentences.length > 0 && (
              <div className="p-5 md:p-6 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                <TextHighlighter text={text} sentences={result.sentences} />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function DimensionLabel({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-lg font-semibold">{value}%</span>
    </div>
  );
}

{/* Spin-reverse and shimmer animations */}
<style>{`
  @keyframes spin-reverse {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-spin-reverse {
    animation: spin-reverse 1s linear infinite;
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
`}</style>