import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'Tajawal', 'Cairo', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0fdfa',
          500: '#14b8a6',
          600: '#0d9488',
          900: '#134e4a',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
