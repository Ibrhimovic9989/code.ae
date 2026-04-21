'use client';

import { useTranslations } from 'next-intl';

export function EditorPanel() {
  const t = useTranslations();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
        {t('workspace.files')}
      </div>
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
        Monaco editor + file tree — Phase B
      </div>
    </div>
  );
}
