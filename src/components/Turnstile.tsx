'use client';

import { useEffect, useRef, useState } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

export default function Turnstile({ siteKey, onVerify, theme = 'auto' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey) return;

    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;

    script.onload = () => {
      if (containerRef.current && window.turnstile) {
        window.turnstile.render(containerRef.current, {
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
        setIsLoaded(true);
      }
    };

    document.body.appendChild(script);

    return () => {
      if (containerRef.current && window.turnstile) {
        try {
          window.turnstile.remove(containerRef.current);
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