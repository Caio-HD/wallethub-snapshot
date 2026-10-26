import { EvolutionOtpAdminService } from '../../src/modules/admin/evolution-otp-admin.service';

function build(opts: {
  wa?: { enabled?: boolean; instanceName?: string };
  capable?: boolean;
  whatsappInstance?: string;
  stateData?: Record<string, unknown>;
  stateThrows?: boolean;
}) {
  const wa = { enabled: false, ...opts.wa };
  const configService = {
    get: jest.fn((ns: string) => {
      if (ns === 'notifications') return { evolutionOtpCapable: opts.capable ?? false };
      if (ns === 'whatsapp') return { evolutionInstanceName: opts.whatsappInstance ?? 'wallethub' };
      return undefined;
    }),
  };
  const evolution = {
    getConnectionState: jest.fn(() =>
      opts.stateThrows
        ? Promise.reject(new Error('down'))
        : Promise.resolve(opts.stateData ?? { instance: { state: 'open' } }),
    ),
    resolveState: jest.fn((d: { instance?: { state?: string } }) => d.instance?.state ?? 'unknown'),
    createInstance: jest.fn().mockResolvedValue(undefined),
    connectInstance: jest.fn().mockResolvedValue({ base64: 'QR' }),
    logoutInstance: jest.fn().mockResolvedValue(undefined),
  };
  const otpSettings = {
    getWhatsApp: jest.fn().mockResolvedValue(wa),
    setWhatsApp: jest.fn((p: Record<string, unknown>) => Promise.resolve({ ...wa, ...p })),
  };
  const service = new EvolutionOtpAdminService(
    configService as never,
    evolution as never,
    otpSettings as never,
  );
  return { service, evolution };
}

describe('EvolutionOtpAdminService', () => {
  it('status: incapaz (sem API key) → não consulta Evolution, connectionState unknown', async () => {
    const { service, evolution } = build({ capable: false });
    const s = await service.getStatus();
    expect(s).toEqual({
      enabled: false,
      instanceName: 'wallethub',
      capable: false,
      connectionState: 'unknown',
    });
    expect(evolution.getConnectionState).not.toHaveBeenCalled();
  });

  it('status: capaz → resolve estado da instância efetiva (settings sobrepõe env)', async () => {
    const { service, evolution } = build({
      capable: true,
      wa: { enabled: true, instanceName: 'wallethub-otp' },
      whatsappInstance: 'wallethub',
      stateData: { instance: { state: 'open' } },
    });
    const s = await service.getStatus();
    expect(s.instanceName).toBe('wallethub-otp');
    expect(s.enabled).toBe(true);
    expect(s.connectionState).toBe('open');
    expect(evolution.getConnectionState).toHaveBeenCalledWith('wallethub-otp');
  });

  it('status: Evolution indisponível → connectionState unreachable (não propaga erro)', async () => {
    const { service } = build({ capable: true, stateThrows: true });
    const s = await service.getStatus();
    expect(s.connectionState).toBe('unreachable');
  });

  it('createInstance usa a instância efetiva', async () => {
    const { service, evolution } = build({ wa: { instanceName: 'wallethub-otp' } });
    const r = await service.createInstance();
    expect(r).toEqual({ instanceName: 'wallethub-otp' });
    expect(evolution.createInstance).toHaveBeenCalledWith('wallethub-otp', expect.any(String));
  });

  it('connect retorna o QR', async () => {
    const { service } = build({});
    await expect(service.connect()).resolves.toEqual({ base64: 'QR' });
  });
});
