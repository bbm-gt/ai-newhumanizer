'use client';

import { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

export default function Turnstile({ siteKey, onVerify, theme = 'auto' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey) return;

    const container = containerRef.current;

    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;

    script.onload = () => {
      if (container && window.turnstile) {
        window.turnstile.render(container, {
          sitekey: siteKey,
          callback: onVerify,
          theme: theme,
          'error-callback': () => {
            console.error('Turnstile error');
          },
          'expired-callback': () => {
            console.warn('Turnstile token expired');
          }
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      if (container && window.turnstile) {
        try {
          window.turnstile.remove(container);
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [siteKey, theme, onVerify]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} className="turnstile-widget" />;
}

// Extend Window interface
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        theme?: 'light' | 'dark' | 'auto';
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
      }) => string;
      remove: (element: HTMLElement) => void;
    };
  }
}