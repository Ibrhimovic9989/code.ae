'use client';

import { useTranslations } from 'next-intl';
import { Button } from '../../../../components/ui';
import { useState } from 'react';

export function PreviewPanel({ previewUrl }: { previewUrl: string | null }) {
  const t = useTranslations();
  const [nonce, setNonce] = useState(0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">{t('workspace.preview')}</span>
        {previewUrl ? (
          <Button variant="ghost" onClick={() => setNonce((n) => n + 1)} className="h-7 px-2 py-0 text-xs">
            ↻
          </Button>
        ) : null}
      </div>
      {previewUrl ? (
        <iframe
          key={nonce}
          src={previewUrl}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-forms allow-same-origin"
          dir="ltr"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-neutral-500">
          {t('workspace.noPreview')}
        </div>
      )}
    </div>
  );
}
