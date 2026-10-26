import { BackupMetricsService } from '@app/modules/backup/backup-metrics.service';
import type { Gauge } from 'prom-client';

const setup = () => {
  const gauge = {
    set: jest.fn(),
  } as unknown as Gauge<string>;

  const service = new BackupMetricsService(gauge);
  return { service, gauge };
};

describe('BackupMetricsService', () => {
  describe('recordBackupSuccess', () => {
    it('sets gauge with provided timestamp', () => {
      const { service, gauge } = setup();
      const ts = 1700000000;

      service.recordBackupSuccess(ts);

      expect(gauge.set).toHaveBeenCalledWith(ts);
    });

    it('uses current time when no timestamp provided', () => {
      const { service, gauge } = setup();
      const before = Math.floor(Date.now() / 1000);

      service.recordBackupSuccess();

      const after = Math.floor(Date.now() / 1000);
      const calledWith = (gauge.set as jest.Mock).mock.calls[0][0] as number;
      expect(calledWith).toBeGreaterThanOrEqual(before);
      expect(calledWith).toBeLessThanOrEqual(after);
    });
  });

  describe('getLastBackupTimestamp', () => {
    it('returns null when no backup has been recorded', () => {
      const { service } = setup();

      expect(service.getLastBackupTimestamp()).toBeNull();
    });

    it('returns timestamp after recording success', () => {
      const { service } = setup();
      const ts = 1700000000;

      service.recordBackupSuccess(ts);

      expect(service.getLastBackupTimestamp()).toBe(ts);
    });

    it('returns null when timestamp is 0', () => {
      const { service } = setup();
      service.recordBackupSuccess(0);

      expect(service.getLastBackupTimestamp()).toBeNull();
    });

    it('returns the most recent timestamp after multiple recordings', () => {
      const { service } = setup();

      service.recordBackupSuccess(1700000000);
      service.recordBackupSuccess(1700100000);

      expect(service.getLastBackupTimestamp()).toBe(1700100000);
    });
  });
});
