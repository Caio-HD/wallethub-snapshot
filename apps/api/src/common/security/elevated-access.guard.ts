import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ElevatedAccessService } from './elevated-access.service';

/**
 * Guards platform-console routes (`admin/platform/*`, `/platform`). Use AFTER JwtAuthGuard so
 * `request.user` is populated. Delegates the decision to {@link ElevatedAccessService} so the
 * kill-switch + MFA precondition are enforced from a single source of truth.
 */
@Injectable()
export class ElevatedAccessGuard implements CanActivate {
  constructor(private readonly elevatedAccess: ElevatedAccessService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.elevatedAccess.assertElevatedAllowed(request.user as AuthenticatedUser | undefined);
    return true;
  }
}
