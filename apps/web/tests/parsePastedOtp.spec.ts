import { describe, expect, it } from 'vitest';
import { parsePastedOtp } from '@features/auth/OtpVerificationView';

describe('parsePastedOtp', () => {
  it('extracts six digits from plain text', () => {
    expect(parsePastedOtp('123456')).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('strips non-digits and spaces from email-style paste', () => {
    expect(parsePastedOtp('Código: 12 34 56')).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('pads with empty strings when fewer than six digits', () => {
    expect(parsePastedOtp('123')).toEqual(['1', '2', '3', '', '', '']);
  });

  it('truncates beyond six digits', () => {
    expect(parsePastedOtp('1234567890')).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});
