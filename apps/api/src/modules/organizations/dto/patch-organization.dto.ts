import { IsString, MaxLength, MinLength } from 'class-validator';

export class PatchOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;
}
