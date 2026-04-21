import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { SlidesService } from './slides.service';
import { ZodValidate } from '../common/zod.pipe';
import { UpdateSlideDto } from '@tellar/api-types';
import { z } from 'zod';

const ReorderDto = z.object({ ids: z.array(z.string().min(1)).min(1) });

@Controller()
@UseGuards(JwtGuard, WorkspaceGuard)
export class SlidesController {
  constructor(private svc: SlidesService) {}

  @Patch('slides/:slideId')
  update(@Param('slideId') slideId: string, @Body(new ZodValidate(UpdateSlideDto)) dto: any) {
    return this.svc.update(slideId, dto);
  }

  @Delete('slides/:slideId')
  remove(@Param('slideId') slideId: string) {
    return this.svc.remove(slideId);
  }

  @Post('slides/:slideId/duplicate')
  duplicate(@Param('slideId') slideId: string) {
    return this.svc.duplicate(slideId);
  }

  @Post('tellers/:tellerId/slides/reorder')
  reorder(
    @Param('tellerId') tellerId: string,
    @Body(new ZodValidate(ReorderDto)) dto: { ids: string[] },
  ) {
    return this.svc.reorder(tellerId, dto.ids);
  }
}
