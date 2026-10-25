import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatchAdminUserDto } from '@app/modules/admin/dto/patch-admin-user.dto';

describe('PatchAdminUserDto', () => {
  it('accepts empty phoneNumber (clears nullable field)', async () => {
    const dto = plainToInstance(PatchAdminUserDto, { phoneNumber: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phoneNumber).toBeNull();
  });

  it('rejects phoneNumber shorter than 8 characters when provided', async () => {
    const dto = plainToInstance(PatchAdminUserDto, { phoneNumber: '123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phoneNumber')).toBe(true);
  });

  it('accepts a valid phoneNumber', async () => {
    const dto = plainToInstance(PatchAdminUserDto, { phoneNumber: '5511988887777' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
