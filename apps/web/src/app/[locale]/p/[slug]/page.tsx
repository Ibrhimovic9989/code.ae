'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../lib/auth-context';
import { api } from '../../../../lib/api-client';
import { Button, Spinner } from '../../../../components/ui';
import { ChatPanel } from './chat-panel';
import { EditorPanel } from './editor-panel';
import { PreviewPanel } from './preview-panel';
import { TerminalPanel } from './terminal-panel';
import { SecretsDialog } from './secrets-dialog';
import { GitHubPushButton } from './github-push-button';
import { PublishButton } from './publish-button';
import { useSessionStream } from './use-session-stream';

export default function ProjectWorkspacePage() {
  const t = useTranslations();
  const params = useParams<{ locale: string; slug: string }>();
  const router = useRouter();
  const { status } = useAuth();
  const slug = params?.slug ?? '';
  const locale = params?.locale ?? 'ar';

  const { project, status: sessStatus, error, turns, sending, send, lastTurnAt } = useSessionStream(
    slug,
    status === 'authenticated',
    (locale === 'en' ? 'en' : 'ar') as 'ar' | 'en',
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [secretsOpen, setSecretsOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${locale}/login`);
  }, [status, router, locale]);

  useEffect(() => {
    if (sessStatus !== 'ready' || !project) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { sandbox } = await api.getSandbox(project.id);
        if (cancelled) return;
        setPreviewUrl(sandbox?.previewUrl ?? null);
      } catch {
        /* ignore */
      }
    };
    void poll();
    const iv = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [sessStatus, project]);

  if (status === 'loading') {
    return <CenterSpinner />;
  }
  if (status === 'unauthenticated') return null;

  return (
    <main className="h-[calc(100vh-3.5rem)]">
      {sessStatus === 'starting' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <Spinner className="h-6 w-6 text-brand-600" />
          <p className="text-sm text-neutral-500">{t('workspace.starting')}</p>
        </div>
      ) : sessStatus === 'error' ? (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            <p className="font-semibold">{t('errors.generic')}</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
            <span className="font-medium">{project?.name}</span>
            <span className="font-mono text-xs text-neutral-500" dir="ltr">
              {project?.slug}
            </span>
            <div className="flex-1" />
            <GitHubPushButton projectId={project?.id ?? null} projectSlug={project?.slug ?? null} />
            <PublishButton projectId={project?.id ?? null} />
            <Button variant="secondary" onClick={() => setSecretsOpen(true)}>
              {t('workspace.env')}
            </Button>
          </div>

          <SecretsDialog projectId={project?.id ?? null} open={secretsOpen} onOpenChange={setSecretsOpen} />

          <div className="grid h-[calc(100%-2.75rem)] grid-cols-1 lg:grid-cols-[420px_1fr_1fr] gap-px bg-neutral-200 dark:bg-neutral-800">
            <section className="min-h-0 bg-white dark:bg-neutral-950">
              <ChatPanel turns={turns} onSend={send} sending={sending} disabled={sessStatus !== 'ready'} />
            </section>
            <section className="hidden min-h-0 grid-rows-[1fr_220px] gap-px bg-neutral-200 lg:grid dark:bg-neutral-800">
              <div className="min-h-0 bg-white dark:bg-neutral-950">
                <EditorPanel
                  projectId={project?.id ?? null}
                  sandboxReady={sessStatus === 'ready'}
                  refreshSignal={lastTurnAt}
                />
              </div>
              <div className="min-h-0">
                <TerminalPanel projectId={project?.id ?? null} sandboxReady={sessStatus === 'ready'} />
              </div>
            </section>
            <section className="hidden min-h-0 bg-white lg:block dark:bg-neutral-950">
              <PreviewPanel previewUrl={previewUrl} />
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function CenterSpinner() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-6 w-6 text-brand-600" />
    </main>
  );
}
