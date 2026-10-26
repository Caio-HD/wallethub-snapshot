import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  categoryIds!: string[];
}
