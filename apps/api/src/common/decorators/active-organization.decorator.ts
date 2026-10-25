import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ActiveOrganizationContext } from '../types/active-organization';

export const ActiveOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveOrganizationContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const org = request.activeOrganization;
    if (!org) {
      throw new Error('ActiveOrganizationDecorator: missing activeOrganization on request');
    }
    return org;
  },
);
