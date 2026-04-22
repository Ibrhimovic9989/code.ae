import { Injectable, Logger } from '@nestjs/common';
import { SandboxAgentClient } from '../domain/sandbox-agent.client';
import { ResolveActiveSandbox } from './resolve-active-sandbox';

export interface HealPreviewResult {
  healed: boolean;
  tookSeconds: number;
  reason?: string;
  /** Condensed log (last ~60 lines of dev.log + probe result). Not shown by default. */
  detail: string;
}

/**
 * The single entry-point for "make the preview work again." Encapsulates the
 * entire recipe we painstakingly debugged with one user:
 *   - Find and kill any process holding port 3000 via /proc/net/tcp (no lsof).
 *   - Clear Next.js's .next cache so a stale errored compilation can't persist.
 *   - Detach-launch `bun run dev` with setsid+nohup so it survives this RPC.
 *   - GET-probe for up to 120s, rejecting 200 responses that carry compile-error
 *     markers (Next serves its error overlay with HTTP 200).
 *
 * Called by the client watchdog whenever the preview iframe is unhealthy, and
 * by the chat agent when the user reports "preview broken." Users should never
 * need to click a "start dev server" button — this runs automatically.
 */
@Injectable()
export class HealPreviewUseCase {
  private readonly logger = new Logger(HealPreviewUseCase.name);

  constructor(
    private readonly resolve: ResolveActiveSandbox,
    private readonly agent: SandboxAgentClient,
  ) {}

  async execute(projectId: string, ownerId: string): Promise<HealPreviewResult> {
    const started = Date.now();
    const endpoint = await this.resolve.execute(projectId, ownerId);

    const script = this.buildRecipe();
    const res = await this.agent.exec(endpoint, {
      command: `bash -lc ${JSON.stringify(script)}`,
      cwd: '.',
      timeoutMs: 220_000,
    });

    const out = (res.stdout ?? '') + (res.stderr ? `\n[stderr]\n${res.stderr}` : '');
    const healed = /CAE_RESULT=healed/.test(out);
    const reason = healed
      ? undefined
      : /CAE_RESULT=port-stuck/.test(out)
        ? 'port-3000-permanently-occupied'
        : /CAE_RESULT=install-failed/.test(out)
          ? 'install-failed'
          : /CAE_RESULT=timeout/.test(out)
            ? 'compile-timeout'
            : 'unknown';

    const detail = this.extractTail(out, 80);

    if (!healed) {
      this.logger.warn(`Heal failed for project ${projectId}: ${reason}`);
    }

    return {
      healed,
      tookSeconds: Math.round((Date.now() - started) / 1000),
      ...(reason ? { reason } : {}),
      detail,
    };
  }

  private buildRecipe(): string {
    // Single bash script. /proc-based port detection works in any Linux container
    // (no lsof/ss/fuser dependency). Port 3000 = hex 0BB8; TCP state 0A = LISTEN.
    return `set +e
cd /home/workspace/project 2>/dev/null || { echo "CAE_RESULT=no-workspace"; exit 0; }
[ -f package.json ] || { echo "CAE_RESULT=no-package-json"; exit 0; }

# Install deps if node_modules missing
if [ ! -d node_modules ]; then
  bun install --no-summary 2>&1 | tail -5 || { echo "CAE_RESULT=install-failed"; exit 0; }
fi

# Kill anything holding port 3000, then anything with next/bun/node in its cmdline
find_port_pids() {
  local inodes
  inodes=$(awk '$2 ~ /:0BB8$/ && $4 == "0A" {print $10}' /proc/net/tcp 2>/dev/null; awk '$2 ~ /:0BB8$/ && $4 == "0A" {print $10}' /proc/net/tcp6 2>/dev/null)
  [ -z "$inodes" ] && return
  for p in /proc/[0-9]*; do
    for i in $inodes; do
      if ls -l $p/fd 2>/dev/null | grep -q "socket:\\[$i\\]"; then
        basename $p
      fi
    done
  done | sort -u
}

for pid in $(find_port_pids); do
  kill -9 $pid 2>/dev/null
done
pkill -9 -f "next" 2>/dev/null
pkill -9 -f "bun.*dev" 2>/dev/null
pkill -9 -f "node.*next" 2>/dev/null
sleep 2

# Verify port is now free
STILL=$(find_port_pids)
if [ -n "$STILL" ]; then
  echo "CAE_RESULT=port-stuck"
  exit 0
fi

# Clear stale Next cache; it doesn't auto-invalidate after bun install
rm -rf .next
> /tmp/dev.log

# Launch dev detached. Don't pass extra -H/-p — the package.json script already
# defines them; duplicates put Next into a weird no-compile state.
setsid nohup bash -c 'HOSTNAME=0.0.0.0 HOST=0.0.0.0 PORT=3000 exec bun run dev' > /tmp/dev.log 2>&1 < /dev/null &

# Warm-up: GET (not HEAD) so Next actually compiles. Accept a CLEAN 200 only.
HEALED=""
for i in $(seq 1 120); do
  sleep 1
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    BODY=$(curl -s --max-time 3 http://localhost:3000 2>/dev/null)
    if ! echo "$BODY" | grep -qE "Module not found|Failed to compile|Internal Server Error|ENOENT|Build Error"; then
      HEALED="$i"
      break
    fi
  fi
done

if [ -n "$HEALED" ]; then
  echo "CAE_RESULT=healed in \${HEALED}s"
else
  echo "CAE_RESULT=timeout"
fi
echo "--- dev.log tail ---"
tail -40 /tmp/dev.log
`;
  }

  private extractTail(out: string, lines: number): string {
    const split = out.split('\n');
    return split.slice(Math.max(0, split.length - lines)).join('\n');
  }
}
