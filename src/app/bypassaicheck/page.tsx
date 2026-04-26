'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Turnstile from '@/components/Turnstile';

const AIDetectionRadarChart = dynamic(
  () => import('@/components/AIDetectionRadarChart'),
  { ssr: false, loading: () => <div className="h-[350px] flex items-center justify-center text-gray-400">Loading chart...</div> }
);

interface CheckResult {
  aiProbability: number;
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
  const needsTurnstile = Boolean(turnstileSiteKey) && text.length > 500;
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

      if (data.aiProbability > 50) {
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
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white pb-safe flex flex-col items-center justify-center p-6 gap-8 transition-all duration-300">
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-3 px-6 text-center text-sm font-medium shadow-lg">
          Warning: High AI probability detected. Consider using Humanizer Pro for better results.
        </div>
      )}

      {showModal && result && result.aiProbability > 50 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <div className="text-center space-y-6">
              <div className="text-5xl">⚠️</div>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">High AI Probability Detected</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Your text has a <span className="font-bold text-red-600">{result.aiProbability}%</span> AI probability score.
              </p>
              <p className="text-sm text-gray-500">
                Use Humanizer Pro to humanize your content and bypass strict AI detectors like Turnitin.
              </p>
              <button
                onClick={openAffiliateLink}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity"
              >
                Try Humanizer Pro - 100% Bypass
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl flex flex-col gap-6 flex-1 pt-12 md:pt-24 pb-24">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">AI Content Detector</h1>
          <p className="text-gray-500 dark:text-gray-400">Paste your text below to detect AI generation.</p>
        </div>

        <div className="relative w-full">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text here..."
            className="w-full min-h-[60vh] p-6 bg-transparent border border-gray-200 dark:border-gray-800 rounded-2xl resize-none focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all duration-300 text-lg shadow-sm"
          />
          <div className="absolute bottom-4 right-6 text-sm text-gray-400 font-mono">
            {text.length}/500
          </div>
        </div>

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

        {showResults && result && (
          <div className="overflow-hidden transition-all duration-500 ease-in-out max-h-[1000px] opacity-100 mt-8">
            <div className="p-8 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm flex flex-col gap-8 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center justify-center gap-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">AI Probability</h3>
                <div className="relative w-48 h-24 overflow-hidden flex items-end justify-center">
                  <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-gray-100 dark:border-gray-900 border-b-transparent border-r-transparent rotate-45 transition-all duration-1000" />
                  <div
                    className={`absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] ${getProbabilityColor(result.aiProbability).replace('text-', 'border-')} border-b-transparent border-r-transparent -rotate-45 transition-all duration-1000`}
                    style={{ transform: `rotate(${-135 + (result.aiProbability * 2.7)}deg)` }}
                  />
                  <span className={`text-4xl font-bold mb-2 ${getProbabilityColor(result.aiProbability)}`}>
                    {result.aiProbability}%
                  </span>
                </div>
                <span className={`text-sm font-medium ${getProbabilityColor(result.aiProbability)}`}>
                  {getProbabilityLabel(result.aiProbability)}
                </span>
              </div>

              <AIDetectionRadarChart
                lexical={result.lexical}
                structural={result.structural}
                tone={result.tone}
                logic={result.logic}
                rhythm={result.rhythm}
                punctuation={result.punctuation}
              />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                <DimensionLabel label="Lexical" value={result.lexical} />
                <DimensionLabel label="Structural" value={result.structural} />
                <DimensionLabel label="Tone" value={result.tone} />
                <DimensionLabel label="Logic" value={result.logic} />
                <DimensionLabel label="Rhythm" value={result.rhythm} />
                <DimensionLabel label="Punctuation" value={result.punctuation} />
              </div>
            </div>
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
