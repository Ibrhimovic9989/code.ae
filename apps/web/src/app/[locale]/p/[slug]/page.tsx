'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../../lib/auth-context';
import { api } from '../../../../lib/api-client';
import { Button, Spinner } from '../../../../components/ui';
import { ChatPanel } from './chat-panel';
import { EditorPanel } from './editor-panel';
import { PreviewPanel, type ViewportSize } from './preview-panel';
import { TerminalPanel } from './terminal-panel';
import { SecretsDialog } from './secrets-dialog';
import { GitHubPushButton } from './github-push-button';
import { PublishButton } from './publish-button';
import { SupabaseButton } from './supabase-button';
import { useSessionStream } from './use-session-stream';
import { useErrorWatcher } from './use-error-watcher';
import { cn } from '../../../../lib/utils';

type RightView = 'code' | 'preview';

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
  const [rightView, setRightView] = useState<RightView>('code');
  const [termOpen, setTermOpen] = useState(true);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

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

  // Auto-switch to preview once the dev server is up
  useEffect(() => {
    if (previewUrl && rightView === 'code') {
      // Don't force-switch; user may be editing. Just nudge on first appearance.
    }
  }, [previewUrl, rightView]);

  const sandboxReadyForWatcher = sessStatus === 'ready';

  // Background error-watcher agent: polls the dev log for build/runtime errors
  // and auto-submits a fix request to the chat agent. Surfaces as a turn with
  // an "auto-fix agent" badge so users see it acting on their behalf.
  useErrorWatcher({
    projectId: project?.id ?? null,
    sandboxReady: sandboxReadyForWatcher,
    agentBusy: sending,
    onAutoFixRequested: send,
  });

  if (status === 'loading') return <CenterSpinner />;
  if (status === 'unauthenticated') return null;

  const sandboxReady = sandboxReadyForWatcher;

  return (
    <main className="h-[calc(100vh-3rem)]">
      {sessStatus === 'starting' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <Spinner className="h-6 w-6 text-neutral-400" />
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
          {/* Top bar */}
          <div className="flex h-11 items-center gap-3 border-b border-neutral-200 bg-white px-4 text-[13px] dark:border-neutral-900 dark:bg-neutral-950">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{project?.name}</span>
            <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-600" dir="ltr">
              {project?.slug}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5">
              <GitHubPushButton projectId={project?.id ?? null} projectSlug={project?.slug ?? null} />
              <SupabaseButton projectId={project?.id ?? null} />
              <PublishButton projectId={project?.id ?? null} />
              <div className="mx-0.5 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
              <Button variant="ghost" size="sm" onClick={() => setSecretsOpen(true)}>
                {t('workspace.env')}
              </Button>
            </div>
          </div>

          <SecretsDialog projectId={project?.id ?? null} open={secretsOpen} onOpenChange={setSecretsOpen} />

          <div className="grid h-[calc(100%-4.5rem)] grid-cols-1 lg:grid-cols-[420px_1fr] gap-px bg-neutral-200 dark:bg-neutral-900">
            <section className="min-h-0 bg-white dark:bg-neutral-950">
              <ChatPanel turns={turns} onSend={send} sending={sending} disabled={!sandboxReady} />
            </section>

            <section className="hidden min-h-0 flex-col lg:flex bg-white dark:bg-neutral-950">
              {/* View switcher + contextual toolbar */}
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 bg-neutral-50/60 px-3 dark:border-neutral-900 dark:bg-neutral-950/60">
                <Segmented
                  value={rightView}
                  onChange={setRightView}
                  options={[
                    { value: 'code', label: 'Code', icon: <CodeIcon /> },
                    { value: 'preview', label: 'Preview', icon: <PreviewIcon /> },
                  ]}
                />
                <div className="flex items-center gap-2">
                  {rightView === 'preview' ? (
                    <ViewportChips value={viewport} onChange={setViewport} />
                  ) : (
                    <button
                      onClick={() => setTermOpen((v) => !v)}
                      className="flex h-7 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900"
                      title={termOpen ? 'Hide terminal' : 'Show terminal'}
                    >
                      <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2.5 4l2 2-2 2M6 9h5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Terminal</span>
                      <svg
                        viewBox="0 0 10 10"
                        className={cn('h-2.5 w-2.5 text-neutral-400 transition-transform', termOpen && 'rotate-180')}
                        fill="none"
                      >
                        <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Body — swap between code view and preview view */}
              <div className="relative min-h-0 flex-1">
                {rightView === 'code' ? (
                  <div
                    className={cn(
                      'grid h-full gap-px bg-neutral-200 dark:bg-neutral-900',
                      termOpen ? 'grid-rows-[1fr_240px]' : 'grid-rows-[1fr_0px]',
                    )}
                  >
                    <div className="min-h-0 bg-white dark:bg-neutral-950">
                      <EditorPanel
                        projectId={project?.id ?? null}
                        sandboxReady={sandboxReady}
                        refreshSignal={lastTurnAt}
                      />
                    </div>
                    {termOpen ? (
                      <div className="min-h-0">
                        <TerminalPanel
                          projectId={project?.id ?? null}
                          sandboxReady={sandboxReady}
                          onClose={() => setTermOpen(false)}
                        />
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                ) : (
                  <PreviewPanel
                    projectId={project?.id ?? null}
                    previewUrl={previewUrl}
                    viewport={viewport}
                  />
                )}
              </div>
            </section>
          </div>

          {/* Status bar */}
          <div
            className="flex h-6 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 font-mono text-[10.5px] text-neutral-500 dark:border-neutral-900 dark:bg-neutral-950 dark:text-neutral-500"
            dir="ltr"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span
                  className={
                    sandboxReady
                      ? 'h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                      : 'h-1.5 w-1.5 rounded-full bg-amber-500'
                  }
                />
                sandbox {sandboxReady ? 'ready' : 'starting'}
              </span>
              <span className="text-neutral-300 dark:text-neutral-800">·</span>
              <span>{project?.slug}</span>
              {previewUrl ? (
                <>
                  <span className="text-neutral-300 dark:text-neutral-800">·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    preview
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span>{rightView}</span>
              <span className="text-neutral-300 dark:text-neutral-800">·</span>
              <span>{turns.length} turns</span>
              <span className="text-neutral-300 dark:text-neutral-800">·</span>
              <span>code.ae</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] font-medium transition-colors',
            value === opt.value
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ViewportChips({
  value,
  onChange,
}: {
  value: ViewportSize;
  onChange: (v: ViewportSize) => void;
}) {
  const chips: { v: ViewportSize; label: string; w: string }[] = [
    { v: 'desktop', label: 'Desktop', w: 'full' },
    { v: 'tablet', label: 'Tablet', w: '768' },
    { v: 'mobile', label: 'Mobile', w: '390' },
  ];
  return (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
      {chips.map((c) => (
        <button
          key={c.v}
          onClick={() => onChange(c.v)}
          title={`${c.label}${c.w !== 'full' ? ` · ${c.w}px` : ''}`}
          className={cn(
            'flex h-7 items-center justify-center gap-1.5 rounded px-2 transition-colors',
            value === c.v
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
          )}
        >
          {c.v === 'desktop' ? <DesktopIcon /> : c.v === 'tablet' ? <TabletIcon /> : <MobileIcon />}
        </button>
      ))}
    </div>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 4L2 7l3 3M9 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PreviewIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="10" height="8" rx="1" />
      <path d="M2 6h10" />
    </svg>
  );
}
function DesktopIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="10" height="7" rx="1" />
      <path d="M5 12h4M7 10v2" strokeLinecap="round" />
    </svg>
  );
}
function TabletIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="2" width="8" height="10" rx="1" />
      <path d="M7 10.5v0.1" strokeLinecap="round" />
    </svg>
  );
}
function MobileIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="6" height="10" rx="1" />
      <path d="M7 10.5v0.1" strokeLinecap="round" />
    </svg>
  );
}

function CenterSpinner() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-6 w-6 text-neutral-400" />
    </main>
  );
}
