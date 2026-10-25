import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValid, parseISO } from 'date-fns';

export interface DateRange {
  start?: Date;
  end?: Date;
}

@Injectable()
export class DateRangePipe implements PipeTransform<string | undefined, DateRange> {
  transform(value: string | undefined, metadata: ArgumentMetadata): DateRange {
    if (!value) {
      return {};
    }

    const [startRaw, endRaw] = value.split(',');
    const start = startRaw ? parseISO(startRaw) : undefined;
    const end = endRaw ? parseISO(endRaw) : undefined;

    if (startRaw && (!start || !isValid(start))) {
      throw new BadRequestException({
        message: 'Período inválido',
        errors: { [metadata.data ?? 'range']: ['Data inicial inválida'] },
      });
    }

    if (endRaw && (!end || !isValid(end))) {
      throw new BadRequestException({
        message: 'Período inválido',
        errors: { [metadata.data ?? 'range']: ['Data final inválida'] },
      });
    }

    if (start && end && start > end) {
      throw new BadRequestException({
        message: 'Período inválido',
        errors: { [metadata.data ?? 'range']: ['Data inicial deve ser anterior à final'] },
      });
    }

    return { start, end };
  }
}
