'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Project } from '@code-ae/shared';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api-client';
import { Button, Card, Input, Label, Spinner, ErrorText } from '../../../components/ui';
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
      <main className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div className="skeleton h-9 w-48" />
          <div className="skeleton h-9 w-32" />
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-8 w-20" />
            </Card>
          ))}
        </div>
      </main>
    );
  }
  if (status === 'unauthenticated') return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 animate-fade-in">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <Button onClick={() => setShowCreate(true)}>{t('dashboard.newProject')}</Button>
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
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500 dark:border-neutral-700">
          {t('dashboard.empty')}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2 transition hover:border-brand-500 hover:shadow-md">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="font-mono text-xs text-neutral-500" dir="ltr">{p.slug}</p>
              {p.description ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{p.description}</p>
              ) : null}
              <div className="mt-auto pt-4">
                <Link
                  href={`/${locale}/p/${p.slug}`}
                  className="inline-flex rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                >
                  {t('dashboard.openProject')} →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
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
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>{t('dashboard.fields.slug')}</Label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          required
          pattern="[a-z0-9\-]+"
          className="mt-1"
          dir="ltr"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>{t('dashboard.fields.description')}</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <Label>{t('dashboard.fields.template')}</Label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner /> : t('dashboard.create')}
        </Button>
        <Button variant="secondary" type="button" onClick={() => onDone(null)}>
          {t('dashboard.cancel')}
        </Button>
      </div>
    </form>
  );
}
