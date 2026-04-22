import type { Messages } from '@/lib/i18n';

export function StackMarquee({ messages }: { messages: Messages }) {
  // Duplicate so the loop wraps seamlessly.
  const items = [...messages.marquee, ...messages.marquee];
  return (
    <section className="relative overflow-hidden hairline-t hairline-b py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[rgb(var(--surface))] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[rgb(var(--surface))] to-transparent"
      />
      <div className="marquee-track flex gap-12 whitespace-nowrap">
        {items.map((label, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.18em] text-neutral-500"
          >
            <span className="h-1 w-1 rounded-full bg-brand-400/60" />
            {label}
          </span>
        ))}
      </div>
      <style>{`
        .marquee-track {
          animation: marquee 35s linear infinite;
          width: max-content;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        [dir='rtl'] .marquee-track {
          animation-direction: reverse;
        }
      `}</style>
    </section>
  );
}
