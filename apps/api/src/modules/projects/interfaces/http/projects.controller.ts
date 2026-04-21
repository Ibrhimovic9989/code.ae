import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CreateProjectUseCase } from '../../application/create-project.usecase';
import { ListProjectsUseCase } from '../../application/list-projects.usecase';
import { JwtAuthGuard } from '../../../auth/interfaces/http/jwt-auth.guard';
import { CurrentUser } from '../../../auth/interfaces/http/current-user.decorator';
import type { AccessTokenPayload } from '../../../auth/infrastructure/jwt.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly createProject: CreateProjectUseCase,
    private readonly listProjects: ListProjectsUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AccessTokenPayload) {
    const projects = await this.listProjects.execute(user.sub);
    return { projects: projects.map((p) => p.toObject()) };
  }

  @Post()
  async create(@CurrentUser() user: AccessTokenPayload, @Body() body: unknown) {
    const project = await this.createProject.execute(user.sub, body);
    return { project: project.toObject() };
  }
}
