import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentEntity } from '../../database/entities/attachment.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttachmentEntity, TransactionEntity]),
    StorageModule,
    ScheduleModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {
  constructor(private readonly attachmentsService: AttachmentsService) {
    // Agendar limpeza de attachments órfãos diariamente
    // Nota: Isso será implementado via @Cron decorator se necessário
  }
}
