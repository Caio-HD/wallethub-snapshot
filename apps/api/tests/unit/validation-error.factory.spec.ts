import { BadRequestException, ValidationError } from '@nestjs/common';
import { validationErrorFactory } from '@app/common/utils/validation-error.factory';

describe('validationErrorFactory', () => {
  const buildError = (
    property: string,
    constraints: Record<string, string> | null,
    children: ValidationError[] = [],
  ): ValidationError => ({
    property,
    constraints: constraints ?? undefined,
    children,
  });

  it('should group constraint messages by field path', () => {
    const errors = [
      buildError('email', { isEmail: 'E-mail inválido' }),
      buildError('address', null, [buildError('street', { isString: 'Rua deve ser texto' })]),
    ];

    const exception = validationErrorFactory(errors);
    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getResponse()).toEqual({
      message: 'Falha de validação',
      errors: {
        email: ['E-mail inválido'],
        'address.street': ['Rua deve ser texto'],
      },
    });
  });
});
