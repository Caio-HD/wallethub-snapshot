import { ForbiddenException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevatedAccessService } from '@app/common/security/elevated-access.service';

const svc = (bypassEnabled: boolean) => {
  const config = {
    get: jest.fn().mockReturnValue(bypassEnabled),
  } as unknown as ConfigService;
  return new ElevatedAccessService(config);
};

describe('ElevatedAccessService', () => {
  const superMfa = { role: 'super_admin' as const, isMfaEnabled: true };
  const superNoMfa = { role: 'super_admin' as const, isMfaEnabled: false };
  const admin = { role: 'admin' as const, isMfaEnabled: true };

  describe('isElevatedAllowed (graceful degrade)', () => {
    it('true for super_admin with MFA and bypass on', () => {
      expect(svc(true).isElevatedAllowed(superMfa)).toBe(true);
    });
    it('false when kill-switch off', () => {
      expect(svc(false).isElevatedAllowed(superMfa)).toBe(false);
    });
    it('false for super_admin without MFA', () => {
      expect(svc(true).isElevatedAllowed(superNoMfa)).toBe(false);
    });
    it('false for non-super_admin', () => {
      expect(svc(true).isElevatedAllowed(admin)).toBe(false);
    });
    it('false for missing user (fail-closed)', () => {
      expect(svc(true).isElevatedAllowed(undefined)).toBe(false);
    });
  });

  describe('assertElevatedAllowed (strict)', () => {
    it('passes for super_admin with MFA and bypass on', () => {
      expect(() => svc(true).assertElevatedAllowed(superMfa)).not.toThrow();
    });
    it('403 (Forbidden) for non-super_admin', () => {
      expect(() => svc(true).assertElevatedAllowed(admin)).toThrow(ForbiddenException);
    });
    it('403 (Forbidden) when kill-switch off', () => {
      expect(() => svc(false).assertElevatedAllowed(superMfa)).toThrow(ForbiddenException);
    });
    it('428 (Precondition Required) when MFA not enrolled', () => {
      expect.assertions(2);
      try {
        svc(true).assertElevatedAllowed(superNoMfa);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(428);
      }
    });
  });
});
