'use client';

import { useTheme, type Theme } from '../lib/theme-context';
import { cn } from '../lib/utils';

const OPTIONS: Array<{ id: Theme; label: string; icon: string }> = [
  { id: 'light', label: 'Light', icon: '☀' },
  { id: 'system', label: 'System', icon: '🖥' },
  { id: 'dark', label: 'Dark', icon: '☾' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex gap-0.5 rounded-md border border-neutral-200 p-0.5 text-xs dark:border-neutral-800" dir="ltr">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setTheme(o.id)}
          title={o.label}
          className={cn(
            'rounded px-1.5 py-1',
            theme === o.id
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
