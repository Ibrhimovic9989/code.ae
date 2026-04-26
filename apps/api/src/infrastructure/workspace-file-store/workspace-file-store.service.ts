import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import type { AppConfig } from '../../config/app.config';

/**
 * The single entry point for storing workspace file *bytes*. Postgres holds
 * the metadata index (path/size/etag) — Blob holds the content. This split
 * keeps the DB tiny and read/write fast: no row ever carries file bytes,
 * and reads can stream straight from Blob without touching the DB.
 *
 * Key layout:  projects/<projectId>/<workspace-relative-path>
 * Auth:        managed identity → Storage Blob Data Contributor on the SA.
 *
 * Per-write latency is dominated by the Blob round-trip (~20-40 ms in-region);
 * the DB upsert that follows is a few ms. Materializing a workspace at
 * sandbox start fans out reads in parallel and is sub-2-second for a
 * standard Next.js app.
 */
@Injectable()
export class WorkspaceFileStore implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceFileStore.name);
  private container!: ContainerClient;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const accountUrl = this.config.get('WORKSPACE_FILES_ACCOUNT_URL', { infer: true });
    const containerName = this.config.get('WORKSPACE_FILES_CONTAINER', { infer: true });
    if (!accountUrl) throw new Error('WORKSPACE_FILES_ACCOUNT_URL not set');
    const service = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
    this.container = service.getContainerClient(containerName);
    this.logger.log(`WorkspaceFileStore ready → ${accountUrl}/${containerName}`);
  }

  /** Upsert content. Returns the resulting etag + size. */
  async put(
    projectId: string,
    path: string,
    content: Buffer | string,
  ): Promise<{ etag: string; size: number }> {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const blob = this.container.getBlockBlobClient(this.key(projectId, path));
    const res = await blob.uploadData(buf, {
      blobHTTPHeaders: { blobContentType: guessContentType(path) },
    });
    // Strip the surrounding quotes Azure returns ("0x8D9...") so we store a
    // plain string the client can compare against directly.
    const etag = (res.etag ?? '').replace(/^"+|"+$/g, '');
    return { etag, size: buf.length };
  }

  /** Read full content as Buffer. Throws if missing. */
  async get(projectId: string, path: string): Promise<Buffer> {
    const blob = this.container.getBlockBlobClient(this.key(projectId, path));
    const res = await blob.downloadToBuffer();
    return res;
  }

  /** Best-effort delete. No-op if blob doesn't exist. */
  async delete(projectId: string, path: string): Promise<void> {
    const blob = this.container.getBlockBlobClient(this.key(projectId, path));
    await blob.deleteIfExists();
  }

  /** List every blob path for a project (workspace-relative). Used by materialize. */
  async list(projectId: string): Promise<string[]> {
    const prefix = `projects/${projectId}/`;
    const out: string[] = [];
    for await (const item of this.container.listBlobsFlat({ prefix })) {
      out.push(item.name.slice(prefix.length));
    }
    return out;
  }

  /**
   * Move within a project. Server-side copy + delete; cheaper than read +
   * upload when content is large. Etag of the new blob is returned.
   */
  async move(
    projectId: string,
    fromPath: string,
    toPath: string,
  ): Promise<{ etag: string }> {
    const src = this.container.getBlockBlobClient(this.key(projectId, fromPath));
    const dst = this.container.getBlockBlobClient(this.key(projectId, toPath));
    const poller = await dst.beginCopyFromURL(src.url);
    const result = await poller.pollUntilDone();
    if (result.copyStatus !== 'success') {
      throw new Error(`Blob copy failed: ${result.copyStatus}`);
    }
    await src.deleteIfExists();
    return { etag: (result.etag ?? '').replace(/^"+|"+$/g, '') };
  }

  private key(projectId: string, path: string): string {
    // Normalize: strip leading ./, leading /, and any path traversal.
    const cleaned = path
      .replace(/^\.\//, '')
      .replace(/^\//, '')
      .replace(/\.\.[/\\]/g, '');
    return `projects/${projectId}/${cleaned}`;
  }
}

function guessContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'text/typescript; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) {
    return 'text/javascript; charset=utf-8';
  }
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}
