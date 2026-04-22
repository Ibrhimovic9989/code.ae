'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Project } from '@code-ae/shared';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api-client';
import { Button, Input, Label, Spinner, ErrorText } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/dialog';

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? 'ar';
  const { status } = useAuth();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const { projects } = await api.listProjects();
      setProjects(projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${locale}/login`);
    if (status === 'authenticated') void load();
  }, [status, router, locale, load]);

  if (status === 'loading' || (status === 'authenticated' && projects === null)) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="skeleton mb-8 h-10 w-56" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-surface p-6">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton mt-3 h-3 w-1/3" />
              <div className="skeleton mt-4 h-3 w-full" />
              <div className="skeleton mt-6 h-8 w-24" />
            </div>
          ))}
        </div>
      </main>
    );
  }
  if (status === 'unauthenticated') return null;

  return (
    <main className="relative isolate mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40vh] mask-fade-bottom">
        <div className="glow-conic absolute left-1/2 top-0 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 opacity-40" />
        <div className="absolute inset-0 bg-dots opacity-50" />
      </div>

      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand-400">
            /dashboard
          </div>
          <h1 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-white md:text-[40px]">
            {t('dashboard.title')}
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500">
            {projects?.length ?? 0} {projects?.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setShowCreate(true)}>
          + {t('dashboard.newProject')}
        </Button>
      </header>

      <ErrorText>{error}</ErrorText>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.createTitle')}</DialogTitle>
            <DialogDescription>{t('dashboard.newProject')}</DialogDescription>
          </DialogHeader>
          <CreateProjectForm
            onDone={(created) => {
              setShowCreate(false);
              if (created) {
                toast.success(`${created.name} created`);
                router.push(`/${locale}/p/${created.slug}`);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {projects && projects.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} label={t('dashboard.empty')} cta={t('dashboard.newProject')} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p, i) => (
            <ProjectCard key={p.id} project={p} locale={locale} index={i} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProjectCard({ project, locale, index }: { project: Project; locale: string; index: number }) {
  return (
    <Link
      href={`/${locale}/p/${project.slug}`}
      className="group card-surface relative flex flex-col p-6 focus-visible:outline-none"
    >
      <div className="absolute end-5 top-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-brand-400/70">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M2 6h12" />
          </svg>
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-500" dir="ltr">
          {project.template ?? 'project'}
        </span>
      </div>
      <h2 className="mt-4 truncate text-[18px] font-semibold tracking-tight text-white">{project.name}</h2>
      <p className="mt-1 truncate font-mono text-[11.5px] text-neutral-500" dir="ltr">
        {project.slug}
      </p>
      {project.description ? (
        <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-neutral-400">{project.description}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between pt-5 text-[12px] text-neutral-500 transition-colors group-hover:text-white">
        <span>Open</span>
        <svg viewBox="0 0 14 14" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 7h8M7 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

function EmptyState({ onCreate, label, cta }: { onCreate: () => void; label: string; cta: string }) {
  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-dashed border-white/10 bg-[rgb(var(--surface-1))] p-16 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 mask-radial-fade">
        <div className="glow-conic absolute left-1/2 top-1/2 h-[40vmin] w-[40vmin] -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="relative">
        <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-[18px] font-semibold text-white">{label}</h2>
        <button onClick={onCreate} className="btn-primary mt-5">
          + {cta}
        </button>
      </div>
    </div>
  );
}

function CreateProjectForm({ onDone }: { onDone: (p: Project | null) => void }) {
  const t = useTranslations();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('next-nest-monorepo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { project } = await api.createProject({
        name,
        slug,
        ...(description ? { description } : {}),
        template,
        visibility: 'private',
      });
      onDone(project);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>{t('dashboard.fields.name')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
      </div>
      <div>
        <Label>{t('dashboard.fields.slug')}</Label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          required
          pattern="[a-z0-9\-]+"
          className="mt-1.5"
          dir="ltr"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>{t('dashboard.fields.description')}</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" />
      </div>
      <div className="sm:col-span-2">
        <Label>{t('dashboard.fields.template')}</Label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="mt-1.5 block h-10 w-full rounded-md border border-white/10 bg-white/[0.02] px-3 text-[13.5px] text-neutral-100 focus:border-white/30 focus:bg-white/[0.04] focus:outline-none"
        >
          <option value="next-nest-monorepo">{t('dashboard.templates.next-nest-monorepo')}</option>
          <option value="next-only">{t('dashboard.templates.next-only')}</option>
          <option value="nest-only">{t('dashboard.templates.nest-only')}</option>
          <option value="blank">{t('dashboard.templates.blank')}</option>
        </select>
      </div>
      {error ? (
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
      ) : null}
      <div className="flex flex-row-reverse gap-2 sm:col-span-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Spinner /> : t('dashboard.create')}
        </button>
        <button type="button" onClick={() => onDone(null)} className="btn-ghost">
          {t('dashboard.cancel')}
        </button>
      </div>
    </form>
  );
}
