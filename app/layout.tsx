import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InternLens — Read the requirements clearly',
  description: 'An HKU-focused internship eligibility checker. Understand explicit requirements and source signals without predicting hiring outcomes.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
