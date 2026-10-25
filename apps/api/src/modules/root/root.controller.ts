import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  root(): Record<string, string> {
    return {
      service: 'wallethub-api',
      api: '/api',
      healthLive: '/api/health/live',
      healthz: '/healthz',
    };
  }

  @Get('healthz')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  healthz(): string {
    return 'ok\n';
  }
}
