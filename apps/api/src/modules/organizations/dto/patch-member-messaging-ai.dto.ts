import { IsBoolean } from 'class-validator';

export class PatchMemberMessagingAiDto {
  @IsBoolean()
  enabled!: boolean;
}
