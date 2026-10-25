import { IsUUID, IsOptional } from 'class-validator';

export class UploadAttachmentDto {
  @IsOptional()
  @IsUUID()
  transactionId?: string;
}
