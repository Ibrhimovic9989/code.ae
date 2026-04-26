/**
 * The list of paths/prefixes we DO NOT mirror into Blob/Postgres. Anything
 * that's reproducible from the source files (bun install output, Next.js
 * build artifacts, version control internals) is excluded — keeping these
 * out keeps DB rows small and materialize fast.
 *
 * We err on the side of persisting — if a path doesn't match any deny rule,
 * it's mirrored. Better to over-store a stray dotfile than to silently lose
 * a hand-written config the next time the sandbox restarts.
 */
const DENY_PREFIXES = [
  'node_modules/',
  '.next/',
  '.turbo/',
  '.cache/',
  'dist/',
  'build/',
  'coverage/',
  '.git/',
  '.vercel/',
  '.parcel-cache/',
];

const DENY_FILES = new Set([
  '.DS_Store',
  'bun.lockb', // re-generated on bun install; massive binary
]);

const DENY_GLOBS = [
  /\.tsbuildinfo$/i,
  /\.log$/i,
];

export function isPersistablePath(rawPath: string): boolean {
  const path = rawPath.replace(/^\.\//, '').replace(/^\//, '');
  for (const prefix of DENY_PREFIXES) {
    if (path === prefix.replace(/\/$/, '')) return false;
    if (path.startsWith(prefix)) return false;
  }
  const base = path.split('/').pop() ?? path;
  if (DENY_FILES.has(base)) return false;
  for (const re of DENY_GLOBS) {
    if (re.test(base)) return false;
  }
  return true;
}
