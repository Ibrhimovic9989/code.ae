import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">
          {t('dashboard.newProject')}
        </button>
      </header>
      <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center text-neutral-500 dark:border-neutral-700">
        {t('dashboard.empty')}
      </div>
    </main>
  );
}
