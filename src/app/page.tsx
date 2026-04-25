import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-4 max-w-md w-full">
        <h1 className="text-3xl font-semibold tracking-tight">Development Portal</h1>
        <p className="text-gray-500">Welcome to the local development environment. Please select a site to preview.</p>
        
        <div className="flex flex-col gap-4 mt-8">
          <Link href="/bypassaicheck" className="p-6 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-black dark:hover:border-white hover:shadow-sm transition-all duration-300 flex items-center justify-between group">
            <span className="font-medium">AI Content Detector</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>
          <Link href="/draftpolish" className="p-6 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-black dark:hover:border-white hover:shadow-sm transition-all duration-300 flex items-center justify-between group">
            <span className="font-medium">Draft Polish Workspace</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
