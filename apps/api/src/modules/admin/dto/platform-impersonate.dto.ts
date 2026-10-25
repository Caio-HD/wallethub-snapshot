import { IsUUID } from 'class-validator';

export class PlatformImpersonateDto {
  @IsUUID('4')
  organizationId!: string;
}
