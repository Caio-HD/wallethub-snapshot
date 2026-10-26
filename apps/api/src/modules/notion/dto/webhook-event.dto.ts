import { IsString, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WebhookDataDto {
  @IsString()
  object!: string;

  @IsString()
  entry?: string;
}

export class NotionWebhookEventDto {
  @IsString()
  object!: string;

  @IsEnum(['created', 'updated', 'deleted'])
  type!: 'created' | 'updated' | 'deleted';

  @IsObject()
  @ValidateNested()
  @Type(() => WebhookDataDto)
  data!: WebhookDataDto;
}
