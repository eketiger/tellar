import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { SlidesService } from './slides.service';
import { ZodValidate } from '../common/zod.pipe';
import { UpdateSlideDto } from '@tellar/api-types';

@Controller('slides')
@UseGuards(JwtGuard, WorkspaceGuard)
export class SlidesController {
  constructor(private svc: SlidesService) {}

  @Patch(':slideId')
  update(@Param('slideId') slideId: string, @Body(new ZodValidate(UpdateSlideDto)) dto: any) {
    return this.svc.update(slideId, dto);
  }

  @Delete(':slideId')
  remove(@Param('slideId') slideId: string) {
    return this.svc.remove(slideId);
  }
}
