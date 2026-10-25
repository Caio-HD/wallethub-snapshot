import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { AdminTokenGuard } from '../../common/guards/admin-token.guard.js';
import { QaAdminService } from './qa-admin.service.js';

class CreateQaTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

class CreateQaUserDto {
  @IsString()
  tenantId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';

  @IsOptional()
  @IsBoolean()
  skipEmailVerification?: boolean;
}

class SeedTransactionDto {
  @IsString()
  tenantId!: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsIn(['income', 'expense'])
  type!: 'income' | 'expense';
}

@Controller('admin/qa')
@UseGuards(AdminTokenGuard)
export class QaAdminController {
  constructor(private readonly qaAdmin: QaAdminService) {}

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() dto: CreateQaTenantDto) {
    return this.qaAdmin.createQaTenant(dto.name);
  }

  @Get('tenants')
  listTenants(@Query('createdBefore') createdBefore?: string) {
    return this.qaAdmin.listQaTenants(createdBefore);
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('confirm') confirm?: string,
  ): Promise<void> {
    await this.qaAdmin.deleteQaTenant(id, confirm);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateQaUserDto) {
    return this.qaAdmin.createQaUser(dto.tenantId, dto.email, dto.password, dto.role ?? 'admin');
  }

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  seedTransaction(@Body() dto: SeedTransactionDto) {
    return this.qaAdmin.seedTransaction(dto.tenantId, dto.description, dto.amount, dto.type);
  }
}
