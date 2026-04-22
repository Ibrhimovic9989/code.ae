import type { NextConfig } from 'next';
import path from 'node:path';

// Pin file-tracing to this app's directory; prevents Next from walking up the
// monorepo and mis-attributing modules from sibling workspaces.
const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname),
};

export default config;
