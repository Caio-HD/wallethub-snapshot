export type Role = 'admin' | 'super_admin';

export interface User {
  id: string;
  name: string;
  username?: string;
  usernameChangedAt?: string | null;
  email?: string | null;
  phoneNumber: string | null;
  photoUrl: string | null;
  role: Role;
  isMfaEnabled?: boolean;
  hasPassword?: boolean;
  telegramUserId?: string | null;
  baseCurrency: string;
  preferredLanguage?: string | null;
  timezone?: string | null;
  linkedProviders?: { google: boolean; github: boolean; facebook: boolean };
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}
