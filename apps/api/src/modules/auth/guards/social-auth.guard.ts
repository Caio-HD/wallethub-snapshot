import { ExecutionContext, Injectable, Type, mixin } from '@nestjs/common';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Guard de login social que repassa o `state` da query ao provedor OAuth.
 *
 * Usado tanto no login normal (sem `state`) quanto no fluxo "conectar conta"
 * (F2): o frontend abre /auth/<provider>?state=<link-token> e o provedor
 * devolve o mesmo `state` no callback, onde a strategy o lê (passReqToCallback)
 * para vincular a conta social ao usuário logado em vez de logar/criar.
 *
 * Só injeta `state` na requisição de autorização inicial (sem `code`); no
 * callback (com `code`) não passamos a opção — evita que o passport tente
 * verificar `state` contra um store de sessão que não usamos.
 */
export function SocialAuthGuard(provider: string): Type<IAuthGuard> {
  @Injectable()
  class SocialAuthGuardMixin extends AuthGuard(provider) {
    getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
      const req = context.switchToHttp().getRequest<Request>();
      const state = typeof req.query?.state === 'string' ? req.query.state : undefined;
      const isCallback = typeof req.query?.code === 'string';
      return state && !isCallback ? { state, session: false } : { session: false };
    }
  }
  return mixin(SocialAuthGuardMixin);
}
