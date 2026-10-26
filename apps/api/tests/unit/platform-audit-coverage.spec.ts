import { Controller, Post, Get, UseGuards, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RolesGuard } from '@app/common/guards/roles.guard';
import { ElevatedAccessGuard } from '@app/common/security/elevated-access.guard';
import { PLATFORM_AUDIT_KEY, AUDIT_EXEMPT_KEY } from '@app/modules/admin/platform-audit.decorator';
import { AdminUsersController } from '@app/modules/admin/admin-users.controller';
import { AdminPlatformController } from '@app/modules/admin/admin-platform.controller';
import { AdminRagController } from '@app/modules/admin/admin-rag.controller';
import { AdminIntegrationsController } from '@app/modules/admin/admin-integrations.controller';
import { AdminAiController } from '@app/modules/admin/admin-ai.controller';
import { QaAdminController } from '@app/modules/admin/qa-admin.controller';

/**
 * Build-time audit-coverage guard-rail.
 *
 * Fails if any MUTATING handler (POST/PUT/PATCH/DELETE) behind the operator guards
 * (ElevatedAccessGuard or RolesGuard) lacks @PlatformAudit or an explicit @AuditExempt.
 * Trigger is the GUARD, not the path prefix — a future controller behind the same guard is
 * covered automatically. Pure metadata reflection: no AppModule boot, no DB.
 */
const MUTATING = new Set<RequestMethod>([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.DELETE,
  RequestMethod.PATCH,
]);

const OPERATOR_GUARDS = [ElevatedAccessGuard, RolesGuard];

type Ctor = new (...args: never[]) => object;

const isOperatorSurface = (controller: Ctor): boolean => {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
  return guards.some((g) => OPERATOR_GUARDS.includes(g as never));
};

/** Returns `Controller.method` for every mutating operator handler missing an audit marker. */
const findOffenders = (controllers: Ctor[]): string[] => {
  const offenders: string[] = [];
  for (const controller of controllers) {
    if (!isOperatorSurface(controller)) continue;
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const handler = proto[name];
      if (typeof handler !== 'function') continue;
      const verb: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, handler);
      if (verb === undefined || !MUTATING.has(verb)) continue;
      const audited = Reflect.getMetadata(PLATFORM_AUDIT_KEY, handler);
      const exempt = Reflect.getMetadata(AUDIT_EXEMPT_KEY, handler);
      if (!audited && !exempt) offenders.push(`${controller.name}.${name}`);
    }
  }
  return offenders;
};

describe('platform audit-coverage guard-rail', () => {
  // Explicit, reviewed list of admin controllers. Adding a new operator controller here is a
  // conscious act; forgetting to add one only hides it from the guard, so keep this in sync with
  // the admin module's `controllers` array.
  const ADMIN_CONTROLLERS: Ctor[] = [
    AdminUsersController,
    AdminPlatformController,
    AdminRagController,
    AdminIntegrationsController,
    AdminAiController,
    QaAdminController,
  ];

  it('every mutating operator handler is marked @PlatformAudit (or @AuditExempt)', () => {
    expect(findOffenders(ADMIN_CONTROLLERS)).toEqual([]);
  });

  it('QaAdminController is not on the operator surface (AdminTokenGuard, server-to-server)', () => {
    expect(isOperatorSurface(QaAdminController)).toBe(false);
  });

  it('detects an unaudited mutating handler behind an operator guard (anti-regression)', () => {
    @Controller('admin/_fixture')
    @UseGuards(ElevatedAccessGuard, RolesGuard)
    class FixtureController {
      @Post('boom')
      mutateWithoutAudit() {
        return null;
      }

      @Get('safe')
      read() {
        return null;
      }
    }

    expect(findOffenders([FixtureController as unknown as Ctor])).toEqual([
      'FixtureController.mutateWithoutAudit',
    ]);
  });
});
