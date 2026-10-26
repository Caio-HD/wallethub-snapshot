import { Injectable } from '@nestjs/common';
import { TenantEvolutionClient } from './tenant-evolution.client.js';
import { DevEvolutionClient } from './dev-evolution.client.js';
@Injectable()
export class EvolutionApiService {
  readonly createInstance: (name: string, secret: string) => Promise<void>;
  readonly setWebhook: (name: string, secret: string) => Promise<void>;
  readonly connectInstance: (name: string) => Promise<Record<string, unknown>>;
  readonly getConnectionState: (name: string) => Promise<Record<string, unknown>>;
  readonly deleteInstance: (name: string) => Promise<void>;
  readonly logoutInstance: (name: string) => Promise<void>;
  readonly sendText: (name: string, number: string, text: string) => Promise<void>;

  constructor(
    private readonly tenant: TenantEvolutionClient,
    private readonly dev: DevEvolutionClient,
  ) {
    this.createInstance = (n, s) => tenant.createInstance(n, s);
    this.setWebhook = (n, s) => tenant.setWebhook(n, s);
    this.connectInstance = (n) => tenant.connectInstance(n);
    this.getConnectionState = (n) => tenant.getConnectionState(n);
    this.deleteInstance = (n) => tenant.deleteInstance(n);
    this.logoutInstance = (n) => tenant.logoutInstance(n);
    this.sendText = (n, num, t) => tenant.sendText(n, num, t);
  }

  resolveState(data: Record<string, unknown>): string {
    return this.tenant.resolveState(data);
  }

  getDevClient(): DevEvolutionClient {
    return this.dev;
  }
}
