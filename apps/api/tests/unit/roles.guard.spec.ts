import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@app/common/guards/roles.guard';
import type { Role } from '@app/common/decorators/roles.decorator';

const ctxFor = (role?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const guardWith = (required: Role[] | undefined) => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

describe('RolesGuard role hierarchy', () => {
  it('allows when no roles are required', () => {
    expect(guardWith(undefined).canActivate(ctxFor('admin'))).toBe(true);
  });

  it('admin satisfies @Roles("admin")', () => {
    expect(guardWith(['admin']).canActivate(ctxFor('admin'))).toBe(true);
  });

  it('admin does NOT satisfy @Roles("super_admin")', () => {
    expect(guardWith(['super_admin']).canActivate(ctxFor('admin'))).toBe(false);
  });

  it('super_admin satisfies @Roles("admin") (hierarchy)', () => {
    expect(guardWith(['admin']).canActivate(ctxFor('super_admin'))).toBe(true);
  });

  it('super_admin satisfies @Roles("super_admin")', () => {
    expect(guardWith(['super_admin']).canActivate(ctxFor('super_admin'))).toBe(true);
  });
});
