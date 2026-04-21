'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '../../../../lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/dialog';
import { Button, Input, Label, Spinner } from '../../../../components/ui';
import { cn } from '../../../../lib/utils';

interface SecretsDialogProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Scope = 'development' | 'production';

interface SecretRow {
  id: string;
  key: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export function SecretsDialog({ projectId, open, onOpenChange }: SecretsDialogProps) {
  const t = useTranslations();
  const [scope, setScope] = useState<Scope>('development');
  const [secrets, setSecrets] = useState<SecretRow[] | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const { secrets } = await api.listSecrets(projectId, scope);
      setSecrets(secrets);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [projectId, scope]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function onUpsert(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setSaving(true);
    try {
      await api.upsertSecret(projectId, { key: newKey, value: newValue, scope });
      toast.success(`${newKey} saved`);
      setNewKey('');
      setNewValue('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, key: string) {
    try {
      await api.deleteSecret(id);
      toast.success(`${key} removed`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent widthClass="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('workspace.env')}</DialogTitle>
          <DialogDescription>{t('secrets.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex gap-1 rounded-md border border-neutral-200 p-0.5 text-xs w-fit dark:border-neutral-800">
          {(['development', 'production'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                'rounded px-2 py-1',
                scope === s
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="max-h-60 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          {secrets === null ? (
            <div className="flex items-center justify-center p-6"><Spinner /></div>
          ) : secrets.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              (none)
            </div>
          ) : (
            <table className="w-full text-sm" dir="ltr">
              <tbody>
                {secrets.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
                    <td className="px-3 py-2 font-mono text-xs">{s.key}</td>
                    <td className="px-3 py-2 text-right text-xs text-neutral-400">
                      ••••••••
                    </td>
                    <td className="px-3 py-2 w-16 text-right">
                      <button
                        type="button"
                        onClick={() => void onDelete(s.id, s.key)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form onSubmit={onUpsert} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label className="text-xs">KEY</Label>
            <Input
              required
              pattern="[A-Z][A-Z0-9_]*"
              placeholder="DATABASE_URL"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              className="mt-1 font-mono text-xs"
              dir="ltr"
            />
          </div>
          <div>
            <Label className="text-xs">VALUE</Label>
            <Input
              required
              type="password"
              placeholder="…"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="mt-1 font-mono text-xs"
              dir="ltr"
            />
          </div>
          <Button type="submit" disabled={saving || !newKey || !newValue}>
            {saving ? <Spinner /> : t('dashboard.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
