import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DraftPolish | Humanize Your Text',
  description: 'Refine your writing and bypass strict AI detectors instantly.',
};

export default function DraftPolishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
