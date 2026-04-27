'use client';

import { useState } from 'react';

export interface Sentence {
  text: string;
  aiProbability: number;
  reason: string;
}

interface TextHighlighterProps {
  text: string;
  sentences: Sentence[];
}

function getHighlightColor(aiProbability: number): string {
  if (aiProbability >= 70) return 'bg-red-500/30 dark:bg-red-500/40';
  if (aiProbability >= 40) return 'bg-yellow-500/30 dark:bg-yellow-500/40';
  return 'bg-green-500/30 dark:bg-green-500/40';
}

function getBorderColor(aiProbability: number): string {
  if (aiProbability >= 70) return 'border-red-500 dark:border-red-400';
  if (aiProbability >= 40) return 'border-yellow-500 dark:border-yellow-400';
  return 'border-green-500 dark:border-green-400';
}

function getTextColor(aiProbability: number): string {
  if (aiProbability >= 70) return 'text-red-600 dark:text-red-400';
  if (aiProbability >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

export default function TextHighlighter({ text, sentences }: TextHighlighterProps) {
  const [showReasons, setShowReasons] = useState(false);
  const [activeSentence, setActiveSentence] = useState<number | null>(null);

  const affiliateLink = process.env.NEXT_PUBLIC_AFFILIATE_LINK || '#';

  // If no sentences data, show original text with placeholder
  if (!sentences || sentences.length === 0) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-lg leading-relaxed whitespace-pre-wrap opacity-50">{text}</p>
        </div>
        <p className="text-sm text-gray-400 text-center">Sentence-level analysis not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          Deep Analysis
        </h3>
        <button
          onClick={() => setShowReasons(!showReasons)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {showReasons ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {/* Highlighted Text */}
      <div className="p-6 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl">
        <div className="text-lg leading-relaxed whitespace-pre-wrap">
          {sentences.map((sentence, idx) => (
            <span
              key={idx}
              className={`
                px-1 py-0.5 rounded transition-all duration-300 cursor-pointer
                ${getHighlightColor(sentence.aiProbability)}
                ${activeSentence === idx ? 'ring-2 ring-offset-2 ring-gray-400' : ''}
              `}
              onClick={() => setActiveSentence(activeSentence === idx ? null : idx)}
              title={`AI Probability: ${sentence.aiProbability}%`}
            >
              {sentence.text}
            </span>
          ))}
        </div>
      </div>

      {/* Sentence Details */}
      {showReasons && (
        <div className="space-y-2">
          {sentences.map((sentence, idx) => (
            <div
              key={idx}
              className={`
                flex items-center justify-between p-3 rounded-lg border
                ${getBorderColor(sentence.aiProbability)}
                ${activeSentence === idx ? 'bg-gray-50 dark:bg-gray-900' : ''}
              `}
              onClick={() => setActiveSentence(activeSentence === idx ? null : idx)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {sentence.text.length > 60
                    ? sentence.text.substring(0, 60) + '...'
                    : sentence.text}
                </p>
                {activeSentence === idx && sentence.reason && (
                  <p className="text-xs text-gray-500 mt-1">
                    {sentence.reason}
                  </p>
                )}
              </div>
              <div className={`ml-4 text-sm font-semibold ${getTextColor(sentence.aiProbability)}`}>
                {sentence.aiProbability}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/40" />
          <span>High AI (70%+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-500/40" />
          <span>Moderate (40-69%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500/40" />
          <span>Low AI (0-39%)</span>
        </div>
      </div>

      {/* Affiliate CTA - 预留的分销链接位置 */}
      {sentences.some(s => s.aiProbability >= 50) && (
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Need stronger humanization?
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Advanced rewriting for strict detectors
              </p>
            </div>
            <a
              href={affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity"
            >
              Try Pro Version
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
