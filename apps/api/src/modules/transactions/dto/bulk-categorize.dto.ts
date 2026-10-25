import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BulkCategorizeDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  transactionIds!: string[];

  @IsUUID()
  categoryId!: string;
}
