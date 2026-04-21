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
}

export function EditorPanel({ projectId, sandboxReady }: EditorPanelProps) {
  const t = useTranslations();
  const { root, expand, collapse, refresh } = useFiles(projectId, sandboxReady);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(
    async (path: string) => {
      if (!projectId) return;
      setLoading(true);
      try {
        const res = await api.readFile(projectId, path);
        setCurrentPath(path);
        setContent(res.content);
      } catch {
        /* ignore */
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

  return (
    <div className="grid h-full grid-cols-[220px_1fr] gap-px bg-neutral-200 dark:bg-neutral-800">
      <aside className="flex min-h-0 flex-col bg-white dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            {t('workspace.files')}
          </span>
          {saving ? <Spinner className="h-3 w-3 text-neutral-500" /> : null}
        </div>
        <div className="flex-1 overflow-auto py-1">
          {root ? (
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
            <div className="p-3 text-xs text-neutral-500">
              {sandboxReady ? '…' : t('workspace.starting')}
            </div>
          )}
        </div>
      </aside>

      <section className="min-h-0 bg-white dark:bg-neutral-950">
        {currentPath ? (
          loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-5 w-5 text-brand-600" />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300" dir="ltr">
                {currentPath}
                {saving ? <span className="ms-2 text-neutral-400">saving…</span> : null}
              </div>
              <div className="min-h-0 flex-1">
                <MonacoEditor path={currentPath} content={content} onChange={onContentChange} />
              </div>
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            ← {t('workspace.files')}
          </div>
        )}
      </section>
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
