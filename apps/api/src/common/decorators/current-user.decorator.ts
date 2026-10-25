import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from './roles.decorator';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  role: Role;
  /** Carried in the JWT so elevated-access checks (MFA gate) stay stateless per request. */
  isMfaEnabled?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    return request.user;
  },
);
