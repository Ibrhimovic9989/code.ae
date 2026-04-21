'use client';

import { useEffect, useState, type FormEvent } from 'react';
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

interface Props {
  projectId: string | null;
  projectSlug: string | null;
}

export function GitHubPushButton({ projectId, projectSlug }: Props) {
  const [login, setLogin] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [repoName, setRepoName] = useState(projectSlug ?? '');
  const [commitMessage, setCommitMessage] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (projectSlug) setRepoName(projectSlug);
  }, [projectSlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { integration } = await api.getGitHubIntegration();
        if (!cancelled) setLogin(integration?.githubLogin ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onConnect() {
    try {
      const { url } = await api.startGitHubOAuth();
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.info('Complete GitHub OAuth in the opened tab, then return here.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function onPush(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await api.pushToGitHub(projectId, {
        ...(repoName ? { repoName } : {}),
        ...(commitMessage ? { commitMessage } : {}),
        privateRepo: isPrivate,
      });
      toast.success(`pushed → ${res.url}`);
      window.open(res.url, '_blank', 'noopener,noreferrer');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (login === null) {
    return (
      <Button variant="secondary" onClick={() => void onConnect()}>
        Connect GitHub
      </Button>
    );
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Push to GitHub
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push to GitHub</DialogTitle>
            <DialogDescription>
              Connected as <span className="font-mono">@{login}</span>. Creates the repo if it doesn&apos;t exist,
              then commits + pushes your workspace from the sandbox.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onPush} className="grid gap-4">
            <div>
              <Label>Repo name</Label>
              <Input
                required
                value={repoName}
                onChange={(e) => setRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                pattern="[a-z0-9\-]+"
                dir="ltr"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label>Commit message (optional)</Label>
              <Input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={`code.ae push ${new Date().toISOString()}`}
                className="mt-1 text-xs"
                dir="ltr"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Private repo
            </label>
            <div className="flex flex-row-reverse gap-2">
              <Button type="submit" disabled={busy || !repoName}>
                {busy ? <Spinner /> : 'Push'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
