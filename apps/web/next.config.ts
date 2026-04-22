import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Pin Next.js's tracing + module resolution to THIS repo. Without this, Next
// walks up looking for a lockfile, hits stray lockfiles in C:\Users\camun\
// or sibling projects (neuro/cortex), and starts pulling node_modules from
// the wrong workspace — manifesting as mysterious webpack factory errors.
const repoRoot = path.resolve(__dirname, '..', '..');

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@code-ae/shared'],
  outputFileTracingRoot: repoRoot,
  typedRoutes: true,
};

export default withNextIntl(config);
