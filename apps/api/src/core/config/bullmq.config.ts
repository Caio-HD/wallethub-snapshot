import { registerAs } from '@nestjs/config';

export const bullConfig = registerAs('bull', () => ({
  connection: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
    password: process.env.REDIS_PASSWORD,
    useTls: process.env.REDIS_TLS === 'true',
  },
  queues: {
    whatsappInbound: 'whatsapp-inbound',
    whatsappOutbound: 'whatsapp-outbound',
    projections: 'projections',
    alerts: 'alerts',
  },
}));
