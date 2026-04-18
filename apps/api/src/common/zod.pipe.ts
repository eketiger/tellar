import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidate<T> implements PipeTransform {
  constructor(private schema: ZodSchema<T>) {}
  transform(value: unknown) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid input',
        issues: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
}
