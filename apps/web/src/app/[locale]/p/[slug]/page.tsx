'use client';

import { useEffect, useMemo, useState } from 'react';
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

type MobileView = 'chat' | 'code' | 'preview';
type DesktopView = 'code' | 'preview';

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
  const [rightView, setRightView] = useState<DesktopView>('code');
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [termOpen, setTermOpen] = useState(false); // mobile default: closed; desktop we flip below
  const [termSheetOpen, setTermSheetOpen] = useState(false); // mobile-only modal terminal
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  // On larger screens, open the terminal by default so it feels like an IDE.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setTermOpen(true);
    }
  }, []);

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

  const sandboxReadyForWatcher = sessStatus === 'ready';

  // Flat list of shell commands the agent has run, in order. The terminal
  // panel dedupes + prints each one as read-only activity so the user can
  // see what the agent is doing even while they have their own pty open.
  const agentActivity = useMemo(() => {
    const lines: string[] = [];
    for (const turn of turns) {
      if (turn.role !== 'assistant') continue;
      for (const tc of turn.toolCalls) {
        if (tc.name === 'exec') {
          const cmd = (tc.input as { command?: string }).command;
          if (cmd) lines.push(`$ ${cmd}`);
        }
      }
    }
    return lines;
  }, [turns]);

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
        <div className="flex h-full items-center justify-center px-4">
          <div className="max-w-md rounded-lg border border-red-900/50 bg-red-950/30 p-6 text-red-100">
            <p className="font-semibold">{t('errors.generic')}</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Top bar — collapses into project name + overflow on mobile */}
          <div className="flex h-11 items-center gap-2 border-b border-white/5 bg-[rgb(var(--surface-0))] px-3 text-[13px] sm:gap-3 sm:px-4">
            <span className="truncate font-medium text-neutral-100">{project?.name}</span>
            <span className="hidden truncate font-mono text-[11px] text-neutral-500 sm:inline" dir="ltr">
              {project?.slug}
            </span>
            <div className="flex-1" />
            {/* Desktop: full toolbar */}
            <div className="hidden items-center gap-1.5 md:flex">
              <GitHubPushButton
                projectId={project?.id ?? null}
                projectSlug={project?.slug ?? null}
                repoUrl={project?.githubRepoUrl ?? null}
              />
              <SupabaseButton
                projectId={project?.id ?? null}
                linkedProjectRef={project?.supabaseProjectRef ?? null}
              />
              <PublishButton
                projectId={project?.id ?? null}
                projectDeploymentUrl={project?.vercelDeploymentUrl ?? null}
              />
              <div className="mx-0.5 h-4 w-px bg-white/10" />
              <Button variant="ghost" size="sm" onClick={() => setSecretsOpen(true)}>
                {t('workspace.env')}
              </Button>
            </div>
            {/* Mobile: overflow trigger */}
            <button
              onClick={() => setOverflowOpen((v) => !v)}
              aria-label="More actions"
              aria-expanded={overflowOpen}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-neutral-300 md:hidden"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <circle cx="3.5" cy="8" r="1.3" />
                <circle cx="8" cy="8" r="1.3" />
                <circle cx="12.5" cy="8" r="1.3" />
              </svg>
            </button>
          </div>

          {/* Mobile overflow sheet */}
          {overflowOpen ? (
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setOverflowOpen(false)}
            >
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-[rgb(var(--surface-1))] p-4 pb-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/10" />
                <div className="flex flex-col gap-2">
                  <div onClick={() => setOverflowOpen(false)}>
                    <GitHubPushButton
                projectId={project?.id ?? null}
                projectSlug={project?.slug ?? null}
                repoUrl={project?.githubRepoUrl ?? null}
              />
                  </div>
                  <div onClick={() => setOverflowOpen(false)}>
                    <SupabaseButton
                projectId={project?.id ?? null}
                linkedProjectRef={project?.supabaseProjectRef ?? null}
              />
                  </div>
                  <div onClick={() => setOverflowOpen(false)}>
                    <PublishButton
                projectId={project?.id ?? null}
                projectDeploymentUrl={project?.vercelDeploymentUrl ?? null}
              />
                  </div>
                  <button
                    onClick={() => {
                      setSecretsOpen(true);
                      setOverflowOpen(false);
                    }}
                    className="flex h-12 items-center rounded-md border border-white/10 bg-white/[0.02] px-3 text-[14px] font-medium text-neutral-200"
                  >
                    {t('workspace.env')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <SecretsDialog projectId={project?.id ?? null} open={secretsOpen} onOpenChange={setSecretsOpen} />

          {/* ─── Desktop layout: chat | code|preview ─── */}
          <div
            className="hidden h-[calc(100%-4.5rem)] grid-cols-[420px_1fr] gap-px bg-white/5 lg:grid"
          >
            <section className="min-h-0 bg-[rgb(var(--surface-0))]">
              <ChatPanel turns={turns} onSend={send} sending={sending} disabled={!sandboxReady} />
            </section>

            <section className="flex min-h-0 flex-col bg-[rgb(var(--surface-0))]">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 bg-[rgb(var(--surface-0))]/60 px-3">
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
                      className="flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-2 text-[12px] text-neutral-400 transition-colors hover:bg-white/[0.05]"
                      title={termOpen ? 'Hide terminal' : 'Show terminal'}
                    >
                      <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2.5 4l2 2-2 2M6 9h5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Terminal</span>
                      <svg
                        viewBox="0 0 10 10"
                        className={cn('h-2.5 w-2.5 text-neutral-500 transition-transform', termOpen && 'rotate-180')}
                        fill="none"
                      >
                        <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                {rightView === 'code' ? (
                  <div
                    className={cn(
                      'grid h-full gap-px bg-white/5',
                      termOpen ? 'grid-rows-[1fr_240px]' : 'grid-rows-[1fr_0px]',
                    )}
                  >
                    <div className="min-h-0 bg-[rgb(var(--surface-0))]">
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
                          agentActivity={agentActivity}
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

          {/* ─── Mobile layout: one panel + bottom tab bar ─── */}
          <div className="relative h-[calc(100%-4.5rem-3.5rem)] lg:hidden">
            {mobileView === 'chat' ? (
              <section className="h-full bg-[rgb(var(--surface-0))]">
                <ChatPanel turns={turns} onSend={send} sending={sending} disabled={!sandboxReady} />
              </section>
            ) : mobileView === 'code' ? (
              <section className="h-full bg-[rgb(var(--surface-0))]">
                <EditorPanel
                  projectId={project?.id ?? null}
                  sandboxReady={sandboxReady}
                  refreshSignal={lastTurnAt}
                />
              </section>
            ) : (
              <section className="h-full bg-[rgb(var(--surface-0))]">
                <PreviewPanel
                  projectId={project?.id ?? null}
                  previewUrl={previewUrl}
                  viewport={viewport}
                />
              </section>
            )}

            {/* Floating terminal toggle (mobile only, Code/Preview views) */}
            {mobileView !== 'chat' ? (
              <button
                onClick={() => setTermSheetOpen(true)}
                className="absolute bottom-3 end-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgb(var(--surface-1))]/80 text-neutral-300 backdrop-blur-lg active:bg-white/[0.06]"
                aria-label="Open terminal"
              >
                <svg viewBox="0 0 14 14" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2.5 4l2 2-2 2M6 9h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}

            {/* Mobile terminal sheet */}
            {termSheetOpen ? (
              <div
                className="fixed inset-0 z-40 bg-black/70 lg:hidden"
                onClick={() => setTermSheetOpen(false)}
              >
                <div
                  className="absolute inset-x-0 bottom-0 h-[70vh] rounded-t-2xl border-t border-white/10 bg-[#0a0a0a]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto mb-2 mt-2.5 h-1 w-10 rounded-full bg-white/10" />
                  <TerminalPanel
                    projectId={project?.id ?? null}
                    sandboxReady={sandboxReady}
                    onClose={() => setTermSheetOpen(false)}
                    agentActivity={agentActivity}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Mobile bottom tab bar */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t border-white/10 bg-[rgb(var(--surface-0))]/90 backdrop-blur-xl lg:hidden">
            <MobileTab
              icon={<ChatIcon />}
              label="Chat"
              active={mobileView === 'chat'}
              onClick={() => setMobileView('chat')}
              {...(turns.length > 0 ? { badge: turns.length } : {})}
            />
            <MobileTab
              icon={<CodeIcon />}
              label="Code"
              active={mobileView === 'code'}
              onClick={() => setMobileView('code')}
            />
            <MobileTab
              icon={<PreviewIcon />}
              label="Preview"
              active={mobileView === 'preview'}
              onClick={() => setMobileView('preview')}
              {...(previewUrl ? { dot: 'emerald' as const } : {})}
            />
          </div>

          {/* Status bar — desktop only */}
          <div
            className="hidden h-6 items-center justify-between border-t border-white/5 bg-[rgb(var(--surface-0))] px-3 font-mono text-[10.5px] text-neutral-500 lg:flex"
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
              <span className="text-neutral-700">·</span>
              <span>{project?.slug}</span>
              {previewUrl ? (
                <>
                  <span className="text-neutral-700">·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    preview
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span>{rightView}</span>
              <span className="text-neutral-700">·</span>
              <span>{turns.length} turns</span>
              <span className="text-neutral-700">·</span>
              <span>code.ae</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function MobileTab({
  icon,
  label,
  active,
  onClick,
  badge,
  dot,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  dot?: 'emerald';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors',
        active ? 'text-white' : 'text-neutral-500 active:text-neutral-300',
      )}
      aria-pressed={active}
    >
      <span className={cn('relative flex items-center', active && 'text-brand-400')}>
        {icon}
        {dot === 'emerald' ? (
          <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        ) : null}
        {badge && badge > 0 ? (
          <span className="absolute -right-2 -top-1 inline-flex min-w-[14px] items-center justify-center rounded-full bg-brand-400/20 px-1 text-[9px] font-semibold text-brand-300">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
      {active ? (
        <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand-400" />
      ) : null}
    </button>
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
    <div className="inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] font-medium transition-colors',
            value === opt.value
              ? 'bg-white text-neutral-900'
              : 'text-neutral-400 hover:text-white',
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
    <div className="inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5">
      {chips.map((c) => (
        <button
          key={c.v}
          onClick={() => onChange(c.v)}
          title={`${c.label}${c.w !== 'full' ? ` · ${c.w}px` : ''}`}
          className={cn(
            'flex h-7 items-center justify-center gap-1.5 rounded px-2 transition-colors',
            value === c.v ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white',
          )}
        >
          {c.v === 'desktop' ? <DesktopIcon /> : c.v === 'tablet' ? <TabletIcon /> : <MobileIcon />}
        </button>
      ))}
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2.5 5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7l-3 2.5V12H4.5a2 2 0 0 1-2-2V5z" strokeLinejoin="round" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5.5 5 2.5 8l3 3M10.5 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PreviewIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="3" width="12" height="10" rx="1.2" />
      <path d="M2 6h12" />
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
