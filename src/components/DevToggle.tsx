'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DevToggle() {
  const [isLocalhost, setIsLocalhost] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLocalhost(true);
      }
    }
  }, []);

  if (!isLocalhost) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 shadow-sm rounded-full px-4 py-2 flex gap-4 transition-all duration-300 hover:shadow-md">
      <Link 
        href="/bypassaicheck" 
        className={`text-sm font-medium transition-colors ${pathname?.startsWith('/bypassaicheck') ? 'text-black dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
      >
        AI Check
      </Link>
      <div className="w-px bg-gray-200 dark:bg-gray-800" />
      <Link 
        href="/draftpolish" 
        className={`text-sm font-medium transition-colors ${pathname?.startsWith('/draftpolish') ? 'text-black dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
      >
        Draft Polish
      </Link>
    </div>
  );
}
