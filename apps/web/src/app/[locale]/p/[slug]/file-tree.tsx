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
    <div className="select-none font-mono text-xs" dir="ltr">
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
        style={{ paddingInlineStart: `${depth * 12 + 8}px` }}
        className={cn(
          'flex cursor-pointer items-center gap-1 rounded px-1 py-0.5',
          active
            ? 'bg-brand-600/15 text-brand-800 dark:text-brand-200'
            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
          hover && 'ring-1 ring-brand-500',
        )}
      >
        <span className="w-3 shrink-0 text-neutral-500">
          {isDir ? (node.expanded ? '▾' : '▸') : ''}
        </span>
        <span className="shrink-0">{isDir ? '📁' : '📄'}</span>
        <span className="truncate">{node.name}</span>
        {node.loading ? <span className="ms-auto text-[10px] text-neutral-400">…</span> : null}
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
