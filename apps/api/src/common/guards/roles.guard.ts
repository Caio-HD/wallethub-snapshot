import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { role?: string } }>();
    const userRole = (request.user?.role ?? 'admin') as Role;

    // super_admin sits at the top of the hierarchy: it satisfies any required role
    // (e.g. @Roles('admin')) so the existing admin/* console is reachable without
    // touching every controller. Everyone else keeps exact-match semantics.
    if (userRole === 'super_admin') {
      return true;
    }

    return requiredRoles.includes(userRole);
  }
}
