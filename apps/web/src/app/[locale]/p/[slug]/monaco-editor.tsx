'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { OnMount } from '@monaco-editor/react';

const Editor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-neutral-500">…</div>,
});

interface MonacoEditorProps {
  path: string;
  content: string;
  onChange: (next: string) => void;
}

export function MonacoEditor({ path, content, onChange }: MonacoEditorProps) {
  const language = useMemo(() => guessLanguage(path), [path]);

  const handleMount: OnMount = (_editor, monaco) => {
    monaco.editor.defineTheme('code-ae-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: { 'editor.background': '#0a0a0a' },
    });
    monaco.editor.setTheme('code-ae-dark');
  };

  return (
    <div className="h-full w-full" dir="ltr">
      <Editor
        path={path}
        value={content}
        language={language}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          automaticLayout: true,
          tabSize: 2,
          fontLigatures: true,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}

function guessLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css', scss: 'scss',
    html: 'html',
    yml: 'yaml', yaml: 'yaml',
    py: 'python',
    sh: 'shell',
    sql: 'sql',
    rs: 'rust',
    go: 'go',
    prisma: 'prisma',
  };
  return map[ext] ?? 'plaintext';
}
