import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RefreshPayload as RefreshPayloadData } from '../auth.service';

type RefreshRequest = Request & { user?: RefreshPayloadData };

export const RefreshPayload = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RefreshPayloadData | undefined => {
    const request = ctx.switchToHttp().getRequest<RefreshRequest>();
    return request.user;
  },
);
