'use client';

import { useState, type DragEvent } from 'react';
import { cn } from '../../../../lib/utils';
import type { TreeNode } from './use-files';

interface FileTreeProps {
  root: TreeNode | null;
  currentPath: string | null;
  onOpen: (path: string) => void;
  onExpand: (path: string) => void;
  onCollapse: (path: string) => void;
  onMove: (from: string, to: string) => void;
  onUpload: (targetDir: string, file: File) => void;
}

export function FileTree({ root, currentPath, onOpen, onExpand, onCollapse, onMove, onUpload }: FileTreeProps) {
  if (!root) return null;
  return (
    <div className="select-none font-mono text-[12px]" dir="ltr">
      {root.children?.map((child) => (
        <TreeRow
          key={child.path}
          node={child}
          depth={0}
          currentPath={currentPath}
          onOpen={onOpen}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onMove={onMove}
          onUpload={onUpload}
        />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  currentPath,
  onOpen,
  onExpand,
  onCollapse,
  onMove,
  onUpload,
}: Omit<FileTreeProps, 'root'> & { node: TreeNode; depth: number }) {
  const [hover, setHover] = useState(false);
  const isDir = node.type === 'dir';
  const active = currentPath === node.path;

  const dragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/code-ae-path', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const dragOver = (e: DragEvent) => {
    if (!isDir) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHover(true);
  };

  const dragLeave = () => setHover(false);

  const drop = async (e: DragEvent) => {
    e.preventDefault();
    setHover(false);
    if (!isDir) return;

    const fromPath = e.dataTransfer.getData('text/code-ae-path');
    if (fromPath && fromPath !== node.path) {
      const parts = fromPath.split('/');
      const name = parts[parts.length - 1] ?? fromPath;
      const to = node.path === '.' ? name : `${node.path}/${name}`;
      if (to !== fromPath) onMove(fromPath, to);
      return;
    }

    for (const file of Array.from(e.dataTransfer.files)) {
      onUpload(node.path, file);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={dragStart}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
        onClick={() => (isDir ? (node.expanded ? onCollapse(node.path) : onExpand(node.path)) : onOpen(node.path))}
        className={cn(
          'group relative flex h-[26px] cursor-pointer items-center gap-1.5 pe-2 text-[12px] transition-colors duration-75',
          active
            ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50'
            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900/60 dark:hover:text-neutral-100',
          hover && 'ring-1 ring-inset ring-neutral-400 dark:ring-neutral-600',
        )}
      >
        {/* Active indicator bar (left edge) */}
        {active ? (
          <span className="absolute inset-y-0 start-0 w-[2px] bg-neutral-900 dark:bg-white" />
        ) : null}

        {/* Depth guides */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-y-0 w-px bg-neutral-200/70 dark:bg-neutral-800/70"
            style={{ insetInlineStart: `${i * 12 + 14}px` }}
          />
        ))}

        {/* Spacer for indent */}
        <span aria-hidden style={{ width: `${depth * 12 + 8}px` }} />

        {/* Chevron */}
        <span className="inline-flex w-3 shrink-0 items-center justify-center">
          {isDir ? <Chevron open={node.expanded ?? false} /> : null}
        </span>

        {/* Icon */}
        {isDir ? (
          <FolderIcon open={node.expanded ?? false} />
        ) : (
          <FileIcon name={node.name} />
        )}

        {/* Name */}
        <span className="truncate">{node.name}</span>

        {node.loading ? (
          <span className="ms-auto text-[10px] font-sans text-neutral-400">…</span>
        ) : null}
      </div>
      {isDir && node.expanded && node.children
        ? node.children.map((c) => (
            <TreeRow
              key={c.path}
              node={c}
              depth={depth + 1}
              currentPath={currentPath}
              onOpen={onOpen}
              onExpand={onExpand}
              onCollapse={onCollapse}
              onMove={onMove}
              onUpload={onUpload}
            />
          ))
        : null}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={cn('h-2.5 w-2.5 text-neutral-400 transition-transform duration-100', open && 'rotate-90')}
      fill="none"
    >
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" fill="none">
      {open ? (
        <path
          d="M2 5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.1"
        />
      ) : (
        <path
          d="M2 5a1 1 0 0 1 1-1h3l1.5 1.5h5.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

const FILE_COLORS: Record<string, string> = {
  tsx: 'text-blue-500',
  ts: 'text-blue-400',
  jsx: 'text-yellow-500',
  js: 'text-yellow-500',
  mjs: 'text-yellow-500',
  cjs: 'text-yellow-500',
  json: 'text-amber-600',
  md: 'text-neutral-500',
  mdx: 'text-neutral-500',
  css: 'text-cyan-500',
  scss: 'text-pink-500',
  html: 'text-orange-500',
  svg: 'text-emerald-500',
  png: 'text-emerald-500',
  jpg: 'text-emerald-500',
  jpeg: 'text-emerald-500',
  webp: 'text-emerald-500',
  gif: 'text-emerald-500',
  prisma: 'text-indigo-500',
  sql: 'text-indigo-400',
  env: 'text-neutral-400',
  toml: 'text-neutral-400',
  yml: 'text-neutral-400',
  yaml: 'text-neutral-400',
  lock: 'text-neutral-400',
  lockb: 'text-neutral-400',
  gitignore: 'text-neutral-400',
};

function FileIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const ext =
    lower === '.gitignore'
      ? 'gitignore'
      : lower.endsWith('.lockb')
        ? 'lockb'
        : (lower.split('.').pop() ?? '');
  const color = FILE_COLORS[ext] ?? 'text-neutral-400';
  return (
    <svg viewBox="0 0 16 16" className={cn('h-3.5 w-3.5 shrink-0', color)} fill="none">
      <path
        d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
