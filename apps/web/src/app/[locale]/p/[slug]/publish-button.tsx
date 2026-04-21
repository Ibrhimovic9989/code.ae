'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
}

type DeployState = 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | 'QUEUED' | 'INITIALIZING' | 'IDLE';

export function PublishButton({ projectId }: Props) {
  const [vercelUsername, setVercelUsername] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [teamId, setTeamId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deployment, setDeployment] = useState<{ url: string; state: DeployState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { integration } = await api.getVercelIntegration();
        if (!cancelled) setVercelUsername(integration?.vercelUsername ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll latest deployment while BUILDING/QUEUED so the UI reflects the current state.
  const refreshDeployment = useCallback(async () => {
    if (!projectId) return;
    try {
      const { deployment } = await api.getLatestDeployment(projectId);
      if (deployment) {
        const url = deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`;
        setDeployment({ url, state: deployment.state as DeployState });
      }
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    if (!deployment || !['BUILDING', 'QUEUED', 'INITIALIZING'].includes(deployment.state)) return;
    const iv = setInterval(refreshDeployment, 5000);
    return () => clearInterval(iv);
  }, [deployment, refreshDeployment]);

  async function onConnect(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setConnecting(true);
    try {
      const { integration } = await api.connectVercel(token.trim(), teamId.trim() || undefined);
      setVercelUsername(integration.vercelUsername);
      setToken('');
      setTeamId('');
      toast.success(`Vercel connected as @${integration.vercelUsername}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  async function onPublish() {
    if (!projectId) return;
    setPublishing(true);
    try {
      const res = await api.publishProject(projectId);
      setDeployment({ url: res.deploymentUrl, state: res.state as DeployState });
      setOpen(false);
      toast.success('Deploying to Vercel…');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  async function onDisconnect() {
    try {
      await api.disconnectVercel();
      setVercelUsername(null);
      setDeployment(null);
      toast.success('Vercel disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  if (vercelUsername === null) {
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Connect Vercel
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Vercel</DialogTitle>
              <DialogDescription>
                Paste a Vercel access token with <span className="font-mono">deployments:write</span> +{' '}
                <span className="font-mono">projects:write</span> scopes. Create one at{' '}
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener"
                  className="text-brand-600 underline"
                >
                  vercel.com/account/tokens
                </a>
                .
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onConnect} className="grid gap-4">
              <div>
                <Label>Access token</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="vercel_xxx…"
                  required
                  dir="ltr"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label>Team ID (optional)</Label>
                <Input
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="team_xxx (leave blank for personal scope)"
                  dir="ltr"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div className="flex flex-row-reverse gap-2">
                <Button type="submit" disabled={connecting || !token.trim()}>
                  {connecting ? <Spinner /> : 'Connect'}
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

  const stateBadge = deployment ? stateChip(deployment.state) : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {stateBadge}
        {deployment && deployment.state === 'READY' ? (
          <a
            href={deployment.url}
            target="_blank"
            rel="noopener"
            className="text-xs text-brand-600 hover:underline"
          >
            {deployment.url.replace(/^https?:\/\//, '')}
          </a>
        ) : null}
        <Button variant="secondary" onClick={onPublish} disabled={publishing || !projectId}>
          {publishing ? <Spinner /> : 'Publish'}
        </Button>
        <button
          type="button"
          onClick={() => void onDisconnect()}
          title={`Vercel: @${vercelUsername} — click to disconnect`}
          className="text-xs text-neutral-500 hover:text-red-500"
        >
          @{vercelUsername}
        </button>
      </div>
    </>
  );
}

function stateChip(state: DeployState) {
  const cls =
    state === 'READY'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
      : state === 'ERROR' || state === 'CANCELED'
        ? 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}>
      {state.toLowerCase()}
    </span>
  );
}
