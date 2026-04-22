'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '../../../../lib/api-client';
import { Spinner } from '../../../../components/ui';
import { FileTree } from './file-tree';
import { MonacoEditor } from './monaco-editor';
import { useFiles } from './use-files';

interface EditorPanelProps {
  projectId: string | null;
  sandboxReady: boolean;
  refreshSignal?: number;
}

export function EditorPanel({ projectId, sandboxReady, refreshSignal }: EditorPanelProps) {
  const t = useTranslations();
  const { root, error: filesError, expand, collapse, refresh } = useFiles(projectId, sandboxReady);

  useEffect(() => {
    if (refreshSignal && refreshSignal > 0) {
      void refresh('.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(
    async (path: string) => {
      if (!projectId) return;
      setLoading(true);
      try {
        const res = await api.readFile(projectId, path);
        setCurrentPath(path);
        setContent(res.content);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  const save = useCallback(
    async (path: string, next: string) => {
      if (!projectId) return;
      setSaving(true);
      try {
        await api.writeFile(projectId, path, next);
        setSavedAt(Date.now());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [projectId],
  );

  const onContentChange = useCallback(
    (next: string) => {
      setContent(next);
      if (!currentPath) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void save(currentPath, next), 800);
    },
    [currentPath, save],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleMove = useCallback(
    async (from: string, to: string) => {
      if (!projectId) return;
      try {
        await api.moveFile(projectId, from, to);
        if (currentPath === from) setCurrentPath(to);
        await refresh('.');
        toast.success(`${from} → ${to}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [projectId, currentPath, refresh],
  );

  const handleUpload = useCallback(
    async (targetDir: string, file: File) => {
      if (!projectId) return;
      const base64 = await fileToBase64(file);
      const destPath = targetDir === '.' ? file.name : `${targetDir}/${file.name}`;
      try {
        await api.writeFileBase64(projectId, destPath, base64);
        await refresh(targetDir);
        toast.success(`uploaded ${file.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [projectId, refresh],
  );

  const restartSandbox = useCallback(async () => {
    if (!projectId) return;
    setRestarting(true);
    try {
      try {
        await api.stopSandbox(projectId);
      } catch {
        /* ignore if already stopped */
      }
      await api.startSandbox(projectId);
      toast.success('Sandbox restarting…');
      setTimeout(() => void refresh('.'), 4000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRestarting(false);
    }
  }, [projectId, refresh]);

  const sandboxNotConnected =
    filesError &&
    (filesError.toLowerCase().includes('sandbox') || filesError.toLowerCase().includes('agent'));

  return (
    <div className="grid h-full grid-cols-[240px_1fr] gap-px bg-neutral-200 dark:bg-neutral-900">
      <aside className="flex min-h-0 flex-col bg-white dark:bg-neutral-950">
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-neutral-200 px-3 dark:border-neutral-900">
          <span className="label-caps">{t('workspace.files')}</span>
          <div className="flex items-center gap-0.5">
            {saving ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> : null}
            <IconBtn title="Reload" onClick={() => void refresh('.')}>
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 2v2.5H7.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 5a3.5 3.5 0 1 0-.5 2.7" strokeLinecap="round" />
              </svg>
            </IconBtn>
          </div>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {filesError && !root ? (
            <div className="m-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="font-semibold">Can&apos;t reach the sandbox</div>
              <div className="mt-1 font-mono text-[11px] opacity-80 break-words">{filesError}</div>
              {sandboxNotConnected ? (
                <button
                  onClick={restartSandbox}
                  disabled={restarting}
                  className="mt-2 inline-flex h-6 items-center gap-1.5 rounded border border-amber-300 bg-white px-2 text-[11px] font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-neutral-900 dark:text-amber-200 dark:hover:bg-neutral-800"
                >
                  {restarting ? <Spinner className="h-3 w-3" /> : '↻'} Restart sandbox
                </button>
              ) : null}
            </div>
          ) : null}
          {root ? (
            root.children && root.children.length > 0 ? (
              <FileTree
                root={root}
                currentPath={currentPath}
                onOpen={open}
                onExpand={expand}
                onCollapse={collapse}
                onMove={handleMove}
                onUpload={handleUpload}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-neutral-300 dark:text-neutral-700" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 7a1 1 0 0 1 1-1h4l2 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z" />
                </svg>
                <div className="text-[12px] text-neutral-500">Workspace is empty</div>
                <div className="font-mono text-[10.5px] text-neutral-400 dark:text-neutral-600">
                  Ask the AI to build something
                </div>
                <button
                  onClick={() => void refresh('.')}
                  className="mt-1 inline-flex h-6 items-center gap-1.5 rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900"
                >
                  ↻ Refresh
                </button>
              </div>
            )
          ) : !filesError ? (
            <div className="p-3 text-[12px] text-neutral-500">
              {sandboxReady ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="h-3 w-3" />
                  Loading files…
                </span>
              ) : (
                t('workspace.starting')
              )}
            </div>
          ) : null}
        </div>
      </aside>

      <section className="min-h-0 bg-white dark:bg-neutral-950">
        {currentPath ? (
          loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-4 w-4 text-neutral-400" />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex h-8 shrink-0 items-center border-b border-neutral-200 dark:border-neutral-900">
                <div
                  className="flex h-full items-center gap-2 border-e border-neutral-200 bg-neutral-50 px-3 text-[12px] font-mono dark:border-neutral-900 dark:bg-neutral-900/50"
                  dir="ltr"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                  <PathBreadcrumb path={currentPath} />
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-1.5 px-3">
                  {saving ? (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      <span className="text-[11px] text-neutral-500">saving</span>
                    </>
                  ) : savedAt ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] text-neutral-500">saved</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <MonacoEditor path={currentPath} content={content} onChange={onContentChange} />
              </div>
            </div>
          )
        ) : (
          <EmptyEditor />
        )}
      </section>
    </div>
  );
}

function IconBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
    />
  );
}

function PathBreadcrumb({ path }: { path: string }) {
  const parts = path.split('/');
  return (
    <span className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 ? <span className="text-neutral-300 dark:text-neutral-700">/</span> : null}
          <span
            className={
              i === parts.length - 1
                ? 'text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 dark:text-neutral-500'
            }
          >
            {p}
          </span>
        </span>
      ))}
    </span>
  );
}

function EmptyEditor() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400 dark:text-neutral-600">
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none">
        <rect x="6" y="8" width="36" height="32" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 16h36" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="12" r="1" fill="currentColor" />
        <circle cx="13" cy="12" r="1" fill="currentColor" />
        <circle cx="16" cy="12" r="1" fill="currentColor" />
      </svg>
      <div className="text-[12px]">Select a file to edit</div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

