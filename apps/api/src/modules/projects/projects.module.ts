import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectRepository } from './domain/project.repository';
import { PrismaProjectRepository } from './infrastructure/prisma-project.repository';
import { CreateProjectUseCase } from './application/create-project.usecase';
import { ListProjectsUseCase } from './application/list-projects.usecase';
import { ProjectsController } from './interfaces/http/projects.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [
    { provide: ProjectRepository, useClass: PrismaProjectRepository },
    CreateProjectUseCase,
    ListProjectsUseCase,
  ],
  exports: [ProjectRepository],
})
export class ProjectsModule {}
