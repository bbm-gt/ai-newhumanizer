'use client';

import { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

export default function Turnstile({ siteKey, onVerify, theme = 'auto' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!siteKey || renderedRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;

    let widgetId: string | undefined;

    const renderWidget = () => {
      if (renderedRef.current || !container) return;
      if (window.turnstile) {
        renderedRef.current = true;
        widgetId = window.turnstile.render(container, {
          sitekey: siteKey,
          callback: onVerify,
          theme: theme,
          'error-callback': () => {
            console.error('Turnstile error');
            renderedRef.current = false;
          },
          'expired-callback': () => {
            console.warn('Turnstile token expired');
            renderedRef.current = false;
          }
        });
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      script.onload = () => {
        if (window.turnstile) {
          renderWidget();
        } else {
          const checkInterval = setInterval(() => {
            if (window.turnstile) {
              clearInterval(checkInterval);
              renderWidget();
            }
          }, 100);
          setTimeout(() => clearInterval(checkInterval), 5000);
        }
      };
      script.onerror = () => {
        console.error('Failed to load Turnstile script');
      };
    }

    document.body.appendChild(script);

    return () => {
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(container);
        } catch {
          // Ignore cleanup errors
        }
        renderedRef.current = false;
      }
      const existingScript = document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [siteKey, theme, onVerify]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="turnstile-widget" />;
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
