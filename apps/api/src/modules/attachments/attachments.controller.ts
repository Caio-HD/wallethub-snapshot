import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new Error('Arquivo não fornecido');
    }

    return this.attachmentsService.upload(file, dto.transactionId, user.id);
  }

  @Get(':id')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { buffer, mimeType, fileName } = await this.attachmentsService.getFile(id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(':id/metadata')
  async getMetadata(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.getMetadata(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.attachmentsService.delete(id, user.id);
  }

  @Post(':id/associate/:transactionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async associateWithTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentsService.associateWithTransaction(id, transactionId, user.id);
  }
}
