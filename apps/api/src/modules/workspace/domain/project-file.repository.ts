export interface ProjectFileRow {
  projectId: string;
  path: string;
  size: number;
  etag: string;
  updatedAt: Date;
}

export abstract class ProjectFileRepository {
  abstract upsert(row: Omit<ProjectFileRow, 'updatedAt'>): Promise<void>;
  abstract delete(projectId: string, path: string): Promise<void>;
  abstract listByProject(projectId: string): Promise<ProjectFileRow[]>;
  abstract findOne(projectId: string, path: string): Promise<ProjectFileRow | null>;
  /** Atomic rename used by move-file. */
  abstract rename(
    projectId: string,
    fromPath: string,
    toPath: string,
    newEtag: string,
  ): Promise<void>;
  /** Bulk replace — used by GitHub restore + similar workflows. */
  abstract replaceAll(projectId: string, rows: Omit<ProjectFileRow, 'updatedAt'>[]): Promise<void>;
}
