import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseAmountPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    if (value === undefined || value === null) {
      throw new BadRequestException({
        message: 'Valor requerido',
        errors: { [metadata.data ?? 'amount']: ['Valor não pode ser vazio'] },
      });
    }

    const normalized = value.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);

    if (Number.isNaN(parsed)) {
      throw new BadRequestException({
        message: 'Valor inválido',
        errors: { [metadata.data ?? 'amount']: ['Valor monetário inválido'] },
      });
    }

    return parsed;
  }
}
