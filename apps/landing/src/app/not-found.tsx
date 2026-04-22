import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">404</div>
      <h1 className="text-2xl font-semibold text-white">This page didn&apos;t compile.</h1>
      <Link href="/en" className="btn-primary">Back home</Link>
    </div>
  );
}
