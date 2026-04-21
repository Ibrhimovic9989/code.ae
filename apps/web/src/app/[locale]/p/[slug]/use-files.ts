'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../../lib/api-client';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  expanded: boolean;
  loading: boolean;
  children: TreeNode[] | null;
}

export function useFiles(projectId: string | null, sandboxReady: boolean) {
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<TreeNode | null>(null);

  const loadRoot = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await api.listFiles(projectId, '.');
      const next: TreeNode = {
        name: '/',
        path: '.',
        type: 'dir',
        expanded: true,
        loading: false,
        children: res.entries.map((e) => ({
          name: e.name,
          path: e.name,
          type: (e.type === 'dir' ? 'dir' : 'file') as 'file' | 'dir',
          expanded: false,
          loading: false,
          children: null,
        })),
      };
      rootRef.current = next;
      setRoot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !sandboxReady) return;
    void loadRoot();
  }, [projectId, sandboxReady, loadRoot]);

  const expand = useCallback(
    async (path: string) => {
      if (!projectId || !rootRef.current) return;
      const node = findNode(rootRef.current, path);
      if (!node || node.type !== 'dir' || node.children) {
        toggleExpand(rootRef.current, path);
        setRoot({ ...rootRef.current });
        return;
      }
      node.loading = true;
      setRoot({ ...rootRef.current });
      try {
        const res = await api.listFiles(projectId, path);
        node.children = res.entries.map((e) => ({
          name: e.name,
          path: joinPath(path, e.name),
          type: (e.type === 'dir' ? 'dir' : 'file') as 'file' | 'dir',
          expanded: false,
          loading: false,
          children: null,
        }));
        node.expanded = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        node.loading = false;
        setRoot({ ...rootRef.current });
      }
    },
    [projectId],
  );

  const collapse = useCallback((path: string) => {
    if (!rootRef.current) return;
    const node = findNode(rootRef.current, path);
    if (!node) return;
    node.expanded = false;
    setRoot({ ...rootRef.current });
  }, []);

  const refresh = useCallback(async (path: string = '.') => {
    if (!projectId || !rootRef.current) return;
    if (path === '.') return loadRoot();
    const node = findNode(rootRef.current, path);
    if (!node || node.type !== 'dir') return loadRoot();
    node.children = null;
    await expand(path);
  }, [projectId, loadRoot, expand]);

  return { root, error, expand, collapse, refresh };
}

function findNode(root: TreeNode, path: string): TreeNode | null {
  if (root.path === path) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const hit = findNode(child, path);
    if (hit) return hit;
  }
  return null;
}

function toggleExpand(root: TreeNode, path: string): void {
  const node = findNode(root, path);
  if (node && node.type === 'dir') node.expanded = !node.expanded;
}

function joinPath(parent: string, name: string): string {
  if (parent === '.' || parent === '') return name;
  return `${parent}/${name}`;
}
