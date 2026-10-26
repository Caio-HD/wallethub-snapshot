import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

export const LEGACY_USERS_ROUTE_HITS_METRIC = 'admin_legacy_users_route_hits_total';

/** Successor of the deprecated `/admin/users` surface. */
const SUCCESSOR = '/admin/platform/users';
/** RFC 7231 date; one deprecation window before the routes are removed (PR5, semver major). */
const SUNSET = 'Wed, 01 Oct 2026 00:00:00 GMT';

/**
 * Marks the legacy `/admin/users` routes as deprecated: emits `Deprecation`/`Sunset`/`Link`
 * headers, a structured warn, and a per-method usage counter. The counter makes the PR5 removal
 * an empirical call ("zero hits in N days") rather than an assumption about who still calls it.
 */
@Injectable()
export class LegacyAdminUsersInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LegacyRoute');

  constructor(
    @InjectMetric(LEGACY_USERS_ROUTE_HITS_METRIC)
    private readonly hits: Counter<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', SUNSET);
    res.setHeader('Link', `<${SUCCESSOR}>; rel="successor-version"`);

    this.logger.warn({
      event: 'legacy_route_hit',
      method: req.method,
      path: req.originalUrl ?? req.url,
      successor: SUCCESSOR,
    });

    try {
      this.hits.inc({ method: req.method });
    } catch (metricErr) {
      // best-effort: a metrics backend hiccup must not block the request.
      void metricErr;
    }

    return next.handle();
  }
}
