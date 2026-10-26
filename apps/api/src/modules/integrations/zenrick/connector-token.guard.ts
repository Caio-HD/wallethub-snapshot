import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Guard S2S do Zenrick Connector (ADR adr-zenrick-connector §4).
 * Token dedicado (WALLETHUB_CONNECTOR_TOKEN) — nunca o WALLETHUB_ADMIN_TOKEN:
 * menor privilégio, comprometimento do connector não dá acesso a backup/QA.
 * Comparação constant-time.
 */
@Injectable()
export class ConnectorTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const token = process.env.WALLETHUB_CONNECTOR_TOKEN;
    if (!token) {
      // Deployável dormante: sem token configurado, a superfície simplesmente não abre.
      throw new UnauthorizedException('WALLETHUB_CONNECTOR_TOKEN not configured');
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'];
    const expected = Buffer.from(`Bearer ${token}`);
    const provided = Buffer.from(typeof auth === 'string' ? auth : '');
    const valid = provided.length === expected.length && timingSafeEqual(provided, expected);
    if (!valid) {
      throw new UnauthorizedException('Invalid connector token');
    }

    return true;
  }
}
