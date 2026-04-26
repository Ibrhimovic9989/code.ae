import { Module } from '@nestjs/common';
import { WorkspaceFileStore } from './workspace-file-store.service';

@Module({
  providers: [WorkspaceFileStore],
  exports: [WorkspaceFileStore],
})
export class WorkspaceFileStoreModule {}
