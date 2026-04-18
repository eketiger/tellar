import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TellersService } from './tellers.service';
import { CreateTellerDto, UpdateTellerDto } from '@tellar/api-types';
import { ZodValidate } from '../common/zod.pipe';

@Controller('tellers')
@UseGuards(JwtGuard)
export class TellersController {
  constructor(private svc: TellersService) {}

  @Get()
  list(
    @CurrentUser() u: any,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.svc.list(u.ws, {
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Post()
  create(@CurrentUser() u: any, @Body(new ZodValidate(CreateTellerDto)) dto: CreateTellerDto) {
    return this.svc.create(u.ws, u.sub, dto.title, dto.theme);
  }

  @Get(':id')
  @UseGuards(WorkspaceGuard)
  get(@Param('id') id: string) {
    return this.svc.getFull(id);
  }

  @Patch(':id')
  @UseGuards(WorkspaceGuard)
  update(@Param('id') id: string, @Body(new ZodValidate(UpdateTellerDto)) dto: UpdateTellerDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(WorkspaceGuard)
  remove(@Param('id') id: string) {
    return this.svc.softDelete(id);
  }

  @Post(':id/slides')
  @UseGuards(WorkspaceGuard)
  addSlide(@Param('id') id: string) {
    return this.svc.addSlide(id);
  }
}
