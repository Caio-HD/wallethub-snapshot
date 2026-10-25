import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { OrganizationsService } from '../../modules/organizations/organizations.service';
import { ElevatedAccessService } from '../security/elevated-access.service';

@Injectable()
export class ActiveOrganizationGuard implements CanActivate {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly elevatedAccess: ElevatedAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.id) {
      throw new UnauthorizedException();
    }
    const headerOrg =
      typeof request.headers['x-organization-id'] === 'string'
        ? request.headers['x-organization-id']
        : undefined;
    // Elevated (super_admin + kill-switch on + MFA) → impersonation bypass; otherwise normal
    // membership resolution. resolveActiveOrganization never returns an unset org, so the
    // @ActiveOrganization() decorator can't throw its raw 500.
    const elevated = this.elevatedAccess.isElevatedAllowed(user);
    request.activeOrganization = await this.organizationsService.resolveActiveOrganization(
      user.id,
      headerOrg,
      { elevated },
    );
    return true;
  }
}
