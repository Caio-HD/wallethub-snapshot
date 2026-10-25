import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Server-to-server guard for QA platform admin endpoints.
 * Validates Authorization: Bearer <WALLETHUB_ADMIN_TOKEN>.
 * Never expose this guard on user-facing routes.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const token = process.env.WALLETHUB_ADMIN_TOKEN;
    if (!token) {
      throw new UnauthorizedException('WALLETHUB_ADMIN_TOKEN not configured');
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];
    if (!auth || auth !== `Bearer ${token}`) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return true;
  }
}
