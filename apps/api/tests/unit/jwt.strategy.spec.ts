import { JwtStrategy } from '@app/modules/auth/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { TEST_PUBLIC_KEY } from '../../test/support/setup-env';

describe('JwtStrategy.validate', () => {
  it('maps JWT sub to AuthenticatedUser id', () => {
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    expect(
      strategy.validate({ sub: 'user-uuid', email: 'u@example.com', role: 'admin' }),
    ).toEqual({
      id: 'user-uuid',
      email: 'u@example.com',
      role: 'admin',
      isMfaEnabled: false,
    });
  });

  it('allows omitted email (maps to null)', () => {
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    expect(strategy.validate({ sub: 'only-sub', role: 'admin' })).toEqual({
      id: 'only-sub',
      email: null,
      role: 'admin',
      isMfaEnabled: false,
    });
  });

  it('carries isMfaEnabled from the token (elevated-access gate)', () => {
    const strategy = Object.create(JwtStrategy.prototype) as JwtStrategy;
    expect(
      strategy.validate({ sub: 's', role: 'super_admin', isMfaEnabled: true }),
    ).toMatchObject({ role: 'super_admin', isMfaEnabled: true });
  });
});

describe('JwtStrategy constructor', () => {
  it('builds strategy with RS256 public key', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue(TEST_PUBLIC_KEY),
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(config);
    expect(strategy).toBeInstanceOf(JwtStrategy);
    expect(config.getOrThrow).toHaveBeenCalledWith('jwt.publicKey');
  });
});