import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Content Detector | Free & Accurate',
  description: 'Check if your text is AI-generated with our advanced detection algorithms.',
};

export default function BypassAICheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
