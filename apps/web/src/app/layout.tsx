import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Code.ae',
  description: 'AI coding platform for the Gulf',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
