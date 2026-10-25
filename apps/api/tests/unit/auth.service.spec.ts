import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService, RefreshPayload } from '@app/modules/auth/auth.service';
import type { UserEntity } from '@app/database/entities/user.entity';
import { LoginDto } from '@app/modules/auth/dto/login.dto';
import { OtpType } from '@app/modules/auth/dto/otp.dto';
import { RefreshTokenStore } from '@app/modules/auth/refresh-token.store';
import { UsersService } from '@app/modules/users/users.service';

jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn().mockReturnValue('11111111-1111-1111-1111-111111111111'),
}));

jest.mock('@app/modules/auth/mfa.service', () => ({
  MfaService: jest.fn(),
}));
jest.mock('@app/modules/auth/webauthn.service', () => ({
  WebAuthnService: jest.fn(),
}));
jest.mock('@app/modules/auth/otp.service', () => ({
  OtpService: jest.fn(),
}));
jest.mock('@app/modules/auth/providers/notification.providers', () => ({
  ResendEmailProvider: jest.fn(),
  TwilioSmsProvider: jest.fn(),
  EvolutionWhatsAppOtpProvider: jest.fn(),
  PhoneOtpDeliveryService: jest.fn(),
}));

describe('AuthService', () => {
  const createService = () => {
    const usersServiceMock = {
      findByEmail: jest.fn<Promise<UserEntity | null>, [string]>(),
      findByUsername: jest.fn<Promise<UserEntity | null>, [string]>(),
      findByPhoneNumber: jest.fn<Promise<UserEntity | null>, [string]>(),
      ensureTwoAdmins: jest.fn<Promise<void>, []>(),
      findById: jest.fn<Promise<UserEntity | null>, [string]>(),
      markEmailVerified: jest.fn<Promise<void>, [string]>(),
      markPhoneVerified: jest.fn<Promise<void>, [string]>(),
      setPasswordHash: jest.fn<Promise<void>, [string, string]>(),
      createPending: jest.fn<Promise<UserEntity>, [object]>(),
      setVerifiedEmail: jest.fn<Promise<UserEntity>, [string, string]>(),
    };
    const jwtServiceMock = {
      signAsync: jest.fn<Promise<string>, [Record<string, unknown>, object?]>(),
    };
    const configServiceMock = {
      get: ((key: string) => {
        if (key === 'jwt.refreshTokenTtl') return '3600s';
        if (key === 'jwt.accessTokenTtl') return '900s';
        return undefined;
      }) as ConfigService['get'],
    };
    const refreshTokenStoreMock = {
      store: jest.fn<Promise<void>, [string, number, string?]>(),
      has: jest.fn<Promise<boolean>, [string]>(),
      get: jest.fn<Promise<string | null>, [string]>(),
      delete: jest.fn<Promise<void>, [string]>(),
    };
    const otpServiceMock = {
      generateOtp: jest.fn<Promise<string>, [string, string?]>(),
      verifyOtp: jest.fn<Promise<boolean>, [string, string, string?]>(),
    };
    const resendEmailMock = {
      sendOtp: jest.fn<Promise<void>, [string, string]>(),
    };
    const phoneOtpDeliveryMock = {
      deliverOtp: jest.fn<Promise<void>, [string, string, object?]>(),
    };
    const organizationsRepositoryMock = {
      findOne: jest.fn<Promise<{ id: string } | null>, [object?]>(),
    };
    const membershipsRepositoryMock = {
      upsert: jest.fn<Promise<void>, [object, string[]]>(),
    };
    const service = new AuthService(
      usersServiceMock as unknown as UsersService,
      jwtServiceMock as unknown as JwtService,
      configServiceMock as unknown as ConfigService,
      refreshTokenStoreMock as unknown as RefreshTokenStore,
      {} as any,
      otpServiceMock as any,
      {} as any,
      resendEmailMock as any,
      phoneOtpDeliveryMock as any,
      organizationsRepositoryMock as any,
      membershipsRepositoryMock as any,
    );

    return {
      service,
      usersService: usersServiceMock,
      jwtService: jwtServiceMock,
      configService: configServiceMock,
      refreshTokenStore: refreshTokenStoreMock,
      otpService: otpServiceMock,
      resendEmail: resendEmailMock,
      phoneOtpDelivery: phoneOtpDeliveryMock,
      organizationsRepository: organizationsRepositoryMock,
      membershipsRepository: membershipsRepositoryMock,
    };
  };

  const sampleUser = (overrides: Partial<UserEntity> = {}): UserEntity => {
    const now = new Date();
    return {
      id: 'user-1',
      email: 'user@example.com',
      username: 'testuser',
      name: 'Test User',
      phoneNumber: '+5511999999999',
      passwordHash: 'hashed',
      isActive: true,
      emailVerified: false,
      phoneVerified: false,
      isMfaEnabled: false,
      role: 'admin',
      baseCurrency: 'BRL',
      transactions: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as unknown as UserEntity;
  };

  it('should issue tokens on login', async () => {
    const { service, usersService, jwtService, refreshTokenStore } = createService();
    const passwordHash = await bcrypt.hash('secret', 1);
    const now = new Date();
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByUsername.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: 'testuser',
      name: 'Test User',
      phoneNumber: '+5511999999999',
      passwordHash,
      isActive: true,
      email_verified: true,
      phone_verified: true,
      isMfaEnabled: false,
      role: 'admin',
      baseCurrency: 'BRL',
      transactions: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as UserEntity);
    usersService.ensureTwoAdmins.mockResolvedValue(undefined);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    refreshTokenStore.store.mockResolvedValue(undefined);

    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'secret',
    };
    const result = await service.login(loginDto);
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      tokenType: 'Bearer',
    });
    expect(usersService.ensureTwoAdmins).toHaveBeenCalledTimes(1);
    expect(refreshTokenStore.store).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh:user-1:/),
      3600,
    );
  });

  it('should throw when credentials are invalid', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByUsername.mockResolvedValue(null);
    usersService.findByPhoneNumber.mockResolvedValue(null);

    const invalidDto: LoginDto = { username: 'missinguser', password: 'secret' };
    await expect(service.login(invalidDto)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject login for inactive account with explicit message', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue(
      sampleUser({ isActive: false, passwordHash: 'hashed' }),
    );
    usersService.findByUsername.mockResolvedValue(null);
    usersService.findByPhoneNumber.mockResolvedValue(null);

    await expect(service.login({ username: 'user@example.com', password: 'secret' })).rejects.toThrow(
      'Conta desactivada',
    );
  });

  it('prefers active account when identifier matches inactive email and active username', async () => {
    const { service, usersService, jwtService, refreshTokenStore } = createService();
    const passwordHash = await bcrypt.hash('secret', 1);
    usersService.findByEmail.mockResolvedValue(
      sampleUser({ id: 'inactive', isActive: false, username: 'shadow' }),
    );
    usersService.findByUsername.mockResolvedValue(
      sampleUser({ id: 'active', isActive: true, username: 'realuser', passwordHash }),
    );
    usersService.findByPhoneNumber.mockResolvedValue(null);
    usersService.ensureTwoAdmins.mockResolvedValue(undefined);
    jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
    refreshTokenStore.store.mockResolvedValue(undefined);

    const result = await service.login({ username: 'realuser', password: 'secret' });

    expect(result.accessToken).toBe('access-token');
  });

  it('should refresh tokens when refresh token exists', async () => {
    const { service, refreshTokenStore, usersService, jwtService } = createService();
    refreshTokenStore.has.mockResolvedValue(true);
    refreshTokenStore.delete.mockResolvedValue(undefined);
    refreshTokenStore.store.mockResolvedValue(undefined);
    usersService.findById.mockResolvedValue(sampleUser());
    usersService.ensureTwoAdmins.mockResolvedValue(undefined);
    jwtService.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');

    const refreshPayload: RefreshPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      tokenId: 'old-token',
    };

    const result = await service.refreshTokens(refreshPayload);

    expect(result.accessToken).toBe('new-access');
    expect(refreshTokenStore.delete).toHaveBeenCalledWith('refresh:user-1:old-token');
    expect(refreshTokenStore.store).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh:user-1:/),
      3600,
    );
  });

  it('should reject refresh when token not found in store', async () => {
    const { service, refreshTokenStore } = createService();
    refreshTokenStore.has.mockResolvedValue(false);

    const refreshPayload: RefreshPayload = {
      sub: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      tokenId: 'missing',
    };
    await expect(service.refreshTokens(refreshPayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('requestOtp email throws when user missing', async () => {
    const { service, usersService } = createService();
    usersService.findByEmail.mockResolvedValue(null);
    await expect(
      service.requestOtp({ type: OtpType.EMAIL, identifier: 'nobody@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requestOtp email generates and sends', async () => {
    const { service, usersService, otpService, resendEmail } = createService();
    usersService.findByEmail.mockResolvedValue(sampleUser());
    otpService.generateOtp.mockResolvedValue('654321');
    const result = await service.requestOtp({
      type: OtpType.EMAIL,
      identifier: ' User@Example.COM ',
    });
    expect(result).toEqual({ success: true });
    expect(otpService.generateOtp).toHaveBeenCalledWith('user@example.com');
    expect(resendEmail.sendOtp).toHaveBeenCalledWith(
      'user@example.com',
      '654321',
      expect.objectContaining({}),
    );
  });

  it('requestOtp phone uses stored number as redis key', async () => {
    const { service, usersService, otpService, phoneOtpDelivery } = createService();
    usersService.findByPhoneNumber.mockResolvedValue(sampleUser({ phoneNumber: '+5511888888888' }));
    otpService.generateOtp.mockResolvedValue('111222');
    await service.requestOtp({ type: OtpType.PHONE, identifier: '+5511888888888' });
    expect(otpService.generateOtp).toHaveBeenCalledWith('+5511888888888');
    expect(phoneOtpDelivery.deliverOtp).toHaveBeenCalledWith(
      '+5511888888888',
      '111222',
      expect.objectContaining({}),
    );
  });

  it('verifyOtp email returns tokens and marks verified', async () => {
    const { service, usersService, otpService, jwtService, refreshTokenStore } = createService();
    otpService.verifyOtp.mockResolvedValue(true);
    usersService.findByEmail.mockResolvedValue(sampleUser());
    usersService.ensureTwoAdmins.mockResolvedValue(undefined);
    usersService.markEmailVerified.mockResolvedValue(undefined);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    refreshTokenStore.store.mockResolvedValue(undefined);

    const result = await service.verifyOtp({
      type: OtpType.EMAIL,
      identifier: 'user@example.com',
      code: '123456',
    });
    expect(result.accessToken).toBe('access-token');
    expect(usersService.markEmailVerified).toHaveBeenCalledWith('user-1');
  });

  it('verifyOtp rejects invalid code', async () => {
    const { service, otpService } = createService();
    otpService.verifyOtp.mockResolvedValue(false);
    await expect(
      service.verifyOtp({
        type: OtpType.EMAIL,
        identifier: 'user@example.com',
        code: '000000',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('registerAndRequestOtp', () => {
    it('creates user, membership and sends email OTP', async () => {
      const {
        service,
        usersService,
        organizationsRepository,
        membershipsRepository,
        otpService,
        resendEmail,
      } = createService();
      usersService.findByEmail
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleUser({ email: 'new@example.com' }));
      usersService.createPending.mockResolvedValue(sampleUser({ email: 'new@example.com' }));
      organizationsRepository.findOne.mockResolvedValue({ id: 'org-1' });
      membershipsRepository.upsert.mockResolvedValue(undefined);
      otpService.generateOtp.mockResolvedValue('123456');
      resendEmail.sendOtp.mockResolvedValue(undefined);

      const result = await service.registerAndRequestOtp({
        name: 'New User',
        email: 'new@example.com',
      });

      expect(result).toEqual({ success: true });
      expect(usersService.createPending).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        phoneNumber: undefined,
      });
      expect(membershipsRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', role: 'member' }),
        ['organizationId', 'userId'],
      );
      expect(resendEmail.sendOtp).toHaveBeenCalledWith(
        'new@example.com',
        '123456',
        expect.objectContaining({}),
      );
    });

    it('returns success without creating duplicate when email exists and is verified', async () => {
      const { service, usersService } = createService();
      usersService.findByEmail.mockResolvedValue(sampleUser({ emailVerified: true }));

      const result = await service.registerAndRequestOtp({
        name: 'Existing',
        email: 'user@example.com',
      });

      expect(result).toEqual({ success: true });
      expect(usersService.createPending).not.toHaveBeenCalled();
    });

    it('resends email OTP when email exists but is not verified', async () => {
      const {
        service,
        usersService,
        otpService,
        resendEmail,
      } = createService();
      usersService.findByEmail.mockResolvedValue(
        sampleUser({ email: 'pending@example.com', emailVerified: false }),
      );
      otpService.generateOtp.mockResolvedValue('654321');
      resendEmail.sendOtp.mockResolvedValue(undefined);

      const result = await service.registerAndRequestOtp({
        name: 'Pending',
        email: 'pending@example.com',
      });

      expect(result).toEqual({ success: true });
      expect(usersService.createPending).not.toHaveBeenCalled();
      expect(resendEmail.sendOtp).toHaveBeenCalledWith(
        'pending@example.com',
        '654321',
        expect.objectContaining({}),
      );
    });

    it('throws when neither email nor phone provided', async () => {
      const { service } = createService();
      await expect(service.registerAndRequestOtp({ name: 'No Contact' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('forgotPassword sends reset OTP to verified email without leaking existence', async () => {
      const { service, usersService, otpService, resendEmail } = createService();
      usersService.findByEmail.mockResolvedValue(
        sampleUser({ email: 'user@example.com', emailVerified: true }),
      );
      otpService.generateOtp.mockResolvedValue('123456');
      resendEmail.sendOtp.mockResolvedValue(undefined);

      const result = await service.forgotPassword({ identifier: 'user@example.com' });

      expect(result).toEqual({ success: true });
      expect(otpService.generateOtp).toHaveBeenCalledWith('user@example.com', 'password_reset');
      expect(resendEmail.sendOtp).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
        expect.objectContaining({}),
      );
    });

    it('forgotPassword returns success when user is unknown', async () => {
      const { service, usersService, otpService } = createService();
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(null);
      usersService.findByPhoneNumber.mockResolvedValue(null);

      const result = await service.forgotPassword({ identifier: 'ghost@example.com' });

      expect(result).toEqual({ success: true });
      expect(otpService.generateOtp).not.toHaveBeenCalled();
    });

    it('resetPassword updates hash when OTP is valid', async () => {
      const { service, usersService, otpService } = createService();
      usersService.findByEmail.mockResolvedValue(
        sampleUser({ email: 'user@example.com', emailVerified: true }),
      );
      otpService.verifyOtp.mockResolvedValue(true);
      usersService.setPasswordHash.mockResolvedValue(undefined);

      const result = await service.resetPassword({
        identifier: 'user@example.com',
        code: '123456',
        password: 'newsecret',
      });

      expect(result).toEqual({ success: true });
      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
        'password_reset',
      );
      expect(usersService.setPasswordHash).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });

    it('resetPassword rejects invalid OTP', async () => {
      const { service, usersService, otpService } = createService();
      usersService.findByEmail.mockResolvedValue(
        sampleUser({ email: 'user@example.com', emailVerified: true }),
      );
      otpService.verifyOtp.mockResolvedValue(false);

      await expect(
        service.resetPassword({
          identifier: 'user@example.com',
          code: '000000',
          password: 'newsecret',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('email change (F3b)', () => {
    it('requestEmailChange sends an OTP to the new address when it is free', async () => {
      const { service, usersService, otpService, resendEmail } = createService();
      usersService.findById.mockResolvedValue({
        id: 'u1',
        email: 'old@x.com',
        preferredLanguage: 'pt',
      } as UserEntity);
      usersService.findByEmail.mockResolvedValue(null);
      otpService.generateOtp.mockResolvedValue('123456');
      resendEmail.sendOtp.mockResolvedValue(undefined);

      const result = await service.requestEmailChange('u1', 'New@X.com');

      expect(result).toEqual({ success: true });
      expect(otpService.generateOtp).toHaveBeenCalledWith('new@x.com', 'email_change');
      expect(resendEmail.sendOtp).toHaveBeenCalledWith('new@x.com', '123456', { lang: 'pt' });
    });

    it('requestEmailChange rejects when the new email belongs to another account', async () => {
      const { service, usersService } = createService();
      usersService.findById.mockResolvedValue({ id: 'u1', email: 'old@x.com' } as UserEntity);
      usersService.findByEmail.mockResolvedValue({ id: 'other' } as UserEntity);

      await expect(service.requestEmailChange('u1', 'taken@x.com')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('confirmEmailChange rejects an invalid code', async () => {
      const { service, otpService } = createService();
      otpService.verifyOtp.mockResolvedValue(false);

      await expect(
        service.confirmEmailChange('u1', 'new@x.com', '000000'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('confirmEmailChange applies the email when the code is valid', async () => {
      const { service, usersService, otpService } = createService();
      otpService.verifyOtp.mockResolvedValue(true);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.setVerifiedEmail.mockResolvedValue({
        id: 'u1',
        email: 'new@x.com',
        emailVerified: true,
      } as UserEntity);

      const result = await service.confirmEmailChange('u1', 'New@X.com', '123456');

      expect(usersService.setVerifiedEmail).toHaveBeenCalledWith('u1', 'new@x.com');
      expect(result.email).toBe('new@x.com');
    });
  });
});
