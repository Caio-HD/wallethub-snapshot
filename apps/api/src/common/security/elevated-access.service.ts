import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

type ActorLike = Pick<AuthenticatedUser, 'role' | 'isMfaEnabled'> | undefined;

/**
 * Single source of truth for "is this request a super_admin allowed to exercise elevated
 * (cross-tenant / platform-console) power?". Both the platform-route guard and the
 * impersonation bypass branch consume this — so the kill-switch + MFA precondition live in
 * exactly one place and a new elevated route cannot silently skip them.
 */
@Injectable()
export class ElevatedAccessService {
  constructor(private readonly config: ConfigService) {}

  /** Global kill-switch state (SUPER_ADMIN_BYPASS_ENABLED). */
  isBypassEnabled(): boolean {
    return this.config.get<boolean>('security.superAdminBypassEnabled') ?? true;
  }

  /**
   * No-throw check, for graceful-degrade paths (impersonation falls back to normal-user
   * behavior when elevation isn't allowed, instead of erroring).
   */
  isElevatedAllowed(user: ActorLike): boolean {
    if (!user || user.role !== 'super_admin') return false;
    if (!this.isBypassEnabled()) return false;
    return user.isMfaEnabled === true;
  }

  /**
   * Strict check for routes that REQUIRE elevation (platform console). Throws a precise error
   * so the frontend can react: 403 when not super_admin / killed, 428 when MFA isn't enrolled.
   */
  assertElevatedAllowed(user: ActorLike): void {
    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException('Acesso restrito ao operador de plataforma (super_admin).');
    }
    if (!this.isBypassEnabled()) {
      throw new ForbiddenException('Acesso de plataforma temporariamente desativado.');
    }
    if (user.isMfaEnabled !== true) {
      throw new HttpException(
        'MFA obrigatório para acesso de plataforma. Ative a verificação em duas etapas.',
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
  }
}
