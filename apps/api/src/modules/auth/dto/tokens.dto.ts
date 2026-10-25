export class TokensDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  tokenType!: 'Bearer';
}
