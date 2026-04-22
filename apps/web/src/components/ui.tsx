import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type HTMLAttributes,
} from 'react';
import { cn } from '../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant = 'secondary', size = 'md', className, ...props }, ref) {
  const base =
    'relative inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none';
  const sizes: Record<ButtonSize, string> = {
    sm: 'h-7 px-2.5 text-[12px]',
    md: 'h-8 px-3 text-[13px]',
    lg: 'h-10 px-4 text-[14px]',
  };
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-white text-neutral-900 border border-white hover:bg-neutral-100 shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_24px_rgba(255,255,255,0.08)] hover:shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_12px_30px_rgba(255,255,255,0.12)] hover:-translate-y-px',
    secondary:
      'border border-white/10 bg-white/[0.02] text-neutral-100 hover:border-white/25 hover:bg-white/[0.05]',
    ghost:
      'text-neutral-400 hover:bg-white/[0.04] hover:text-white',
    danger:
      'bg-red-600 text-white border border-red-600 hover:bg-red-500',
  };
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'block h-10 w-full rounded-md border border-white/10 bg-white/[0.02] px-3 text-[13.5px] text-neutral-100 placeholder:text-neutral-500 transition-colors duration-150',
          'focus:border-white/30 focus:bg-white/[0.04] focus:outline-none',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn('block text-[12px] font-medium text-neutral-400', className)}
        {...props}
      />
    );
  },
);

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-surface p-6', className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-[12.5px] text-red-400">{children}</p>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center rounded border border-white/10 bg-white/[0.03] px-1.5 font-mono text-[11px] font-medium text-neutral-400">
      {children}
    </kbd>
  );
}
