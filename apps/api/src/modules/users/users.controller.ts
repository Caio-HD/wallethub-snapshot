import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveOrganizationGuard } from '../../common/guards/active-organization.guard';
import { ActiveOrganization } from '../../common/decorators/active-organization.decorator';
import type { ActiveOrganizationContext } from '../../common/types/active-organization';
import { OrganizationsService } from '../organizations/organizations.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get('active')
  @UseGuards(JwtAuthGuard, ActiveOrganizationGuard)
  listActiveUsers(@ActiveOrganization() org: ActiveOrganizationContext) {
    return this.organizationsService.listActiveMembersForSelector(org.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const entity = await this.usersService.findById(user.id);
    if (!entity) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return {
      id: entity.id,
      name: entity.name,
      username: entity.username,
      usernameChangedAt: entity.usernameChangedAt ?? null,
      email: entity.email,
      phoneNumber: entity.phoneNumber,
      photoUrl: entity.photoUrl,
      role: entity.role,
      isMfaEnabled: entity.isMfaEnabled,
      hasPassword: entity.hasPassword,
      baseCurrency: entity.baseCurrency,
      preferredLanguage: entity.preferredLanguage ?? null,
      timezone: entity.timezone ?? null,
      linkedProviders: {
        google: !!entity.googleId,
        github: !!entity.githubId,
        facebook: !!entity.facebookId,
      },
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const entity = await this.usersService.updateProfile(user.id, dto);
    return {
      id: entity.id,
      name: entity.name,
      username: entity.username,
      usernameChangedAt: entity.usernameChangedAt ?? null,
      email: entity.email,
      phoneNumber: entity.phoneNumber,
      photoUrl: entity.photoUrl,
      role: entity.role,
      isMfaEnabled: entity.isMfaEnabled,
      baseCurrency: entity.baseCurrency,
      preferredLanguage: entity.preferredLanguage ?? null,
      timezone: entity.timezone ?? null,
      linkedProviders: {
        google: !!entity.googleId,
        github: !!entity.githubId,
        facebook: !!entity.facebookId,
      },
    };
  }

  @Patch('me/username')
  @UseGuards(JwtAuthGuard)
  async changeUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeUsernameDto,
  ): Promise<{ username: string; usernameChangedAt: Date | null }> {
    const entity = await this.usersService.changeUsername(user.id, dto.username);
    return { username: entity.username, usernameChangedAt: entity.usernameChangedAt ?? null };
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    await this.usersService.changePassword(user.id, {
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
    return { success: true };
  }

  @Post('photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPhoto(
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new NotFoundException('Arquivo não fornecido');
    }
    const photoUrl = await this.usersService.updatePhoto(currentUser.id, file);
    return { photoUrl };
  }

  @Get('photo/:id')
  async getPhoto(@Param('id') id: string, @Res() res: Response) {
    const photo = await this.usersService.getPhoto(id);
    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }

    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(photo.buffer);
  }
}
