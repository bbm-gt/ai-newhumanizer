'use client';

import { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

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

let scriptLoaded = false;
let scriptLoading = false;

export default function Turnstile({ siteKey, onVerify, theme = 'auto' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const container = containerRef.current;

    const renderWidget = () => {
      if (window.turnstile && container && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          callback: (token) => {
            hasVerified.current = true;
            onVerify(token);
          },
          theme: theme,
          'error-callback': () => {
            console.error('Turnstile error');
          },
          'expired-callback': () => {
            console.warn('Turnstile token expired');
            widgetIdRef.current = null;
            hasVerified.current = false;
          }
        });
      }
    };

    const loadScript = () => {
      if (scriptLoaded) {
        renderWidget();
        return;
      }

      if (scriptLoading) {
        const checkInterval = setInterval(() => {
          if (scriptLoaded) {
            clearInterval(checkInterval);
            renderWidget();
          }
        }, 50);
        return;
      }

      scriptLoading = true;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;

      script.onload = () => {
        scriptLoaded = true;
        scriptLoading = false;
        renderWidget();
      };

      script.onerror = () => {
        scriptLoading = false;
        console.error('Failed to load Turnstile script');
      };

      document.body.appendChild(script);
    };

    loadScript();

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(container);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="turnstile-widget" />;
}