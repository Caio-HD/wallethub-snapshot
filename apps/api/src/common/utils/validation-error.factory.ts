import { BadRequestException, ValidationError } from '@nestjs/common';

function extractErrors(errors: ValidationError[], parentPath?: string): Record<string, string[]> {
  return errors.reduce<Record<string, string[]>>((acc, error) => {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints) {
      acc[fieldPath] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(acc, extractErrors(error.children, fieldPath));
    }
    return acc;
  }, {});
}

export function validationErrorFactory(errors: ValidationError[]): BadRequestException {
  const formatted = extractErrors(errors);
  return new BadRequestException({
    message: 'Falha de validação',
    errors: formatted,
  });
}
