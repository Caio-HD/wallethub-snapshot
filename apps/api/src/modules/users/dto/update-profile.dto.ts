import { IsIn, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../../common/constants/currencies.js';
import { SUPPORTED_LANGUAGES } from '../../../common/constants/languages.js';
import { SUPPORTED_TIMEZONES } from '../../../common/constants/timezones.js';
import { SUPPORTED_THEMES } from '../../../common/constants/themes.js';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsPhoneNumber('BR')
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  baseCurrency?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  preferredLanguage?: string;

  @IsOptional()
  @IsIn(SUPPORTED_TIMEZONES)
  timezone?: string;

  @IsOptional()
  @IsIn(SUPPORTED_THEMES)
  preferredTheme?: (typeof SUPPORTED_THEMES)[number];
}
