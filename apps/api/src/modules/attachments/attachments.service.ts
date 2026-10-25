import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { AttachmentEntity } from '../../database/entities/attachment.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @InjectRepository(AttachmentEntity)
    private readonly attachmentsRepository: Repository<AttachmentEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>('storage.maxFileSize') || 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = this.configService.get<string[]>('storage.allowedMimeTypes') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
  }

  async upload(
    file: Express.Multer.File,
    transactionId?: string,
    userId?: string,
  ): Promise<AttachmentEntity> {
    // Validar tamanho
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `Arquivo muito grande. Tamanho máximo: ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Validar tipo MIME
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido. Tipos permitidos: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Salvar no storage
    const storagePath = await this.storageService.saveFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Criar registro no banco
    const attachment = this.attachmentsRepository.create({
      fileName: file.originalname,
      mimeType: file.mimetype,
      storagePath,
    });

    // Associar com transação se fornecida
    if (transactionId) {
      const transaction = await this.transactionsRepository.findOne({
        where: { id: transactionId },
      });

      if (!transaction) {
        // Se transação não existe, remover arquivo do storage
        await this.storageService.deleteFile(storagePath);
        throw new NotFoundException(`Transação não encontrada: ${transactionId}`);
      }

      // Verificar se transação já tem attachment
      const existingAttachment = await this.attachmentsRepository.findOne({
        where: { transaction: { id: transactionId } },
      });

      if (existingAttachment) {
        // Remover attachment antigo
        await this.delete(existingAttachment.id, userId);
      }

      attachment.transaction = transaction;
    }

    const saved = await this.attachmentsRepository.save(attachment);
    this.logger.debug(`Attachment criado: ${saved.id}`);
    return saved;
  }

  async getFile(id: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const attachment = await this.attachmentsRepository.findOne({ where: { id } });

    if (!attachment) {
      throw new NotFoundException(`Attachment não encontrado: ${id}`);
    }

    return this.storageService.getFile(attachment.storagePath);
  }

  async getMetadata(id: string): Promise<AttachmentEntity> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id },
      relations: ['transaction'],
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment não encontrado: ${id}`);
    }

    return attachment;
  }

  async delete(id: string, _userId?: string): Promise<void> {
    const attachment = await this.attachmentsRepository.findOne({ where: { id } });

    if (!attachment) {
      throw new NotFoundException(`Attachment não encontrado: ${id}`);
    }

    // Remover do storage
    try {
      await this.storageService.deleteFile(attachment.storagePath);
    } catch (error) {
      this.logger.warn(
        `Falha ao remover arquivo do storage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Remover do banco
    await this.attachmentsRepository.remove(attachment);
    this.logger.debug(`Attachment removido: ${id}`);
  }

  async associateWithTransaction(
    attachmentId: string,
    transactionId: string,
    userId: string,
  ): Promise<AttachmentEntity> {
    const attachment = await this.attachmentsRepository.findOne({ where: { id: attachmentId } });
    if (!attachment) {
      throw new NotFoundException(`Attachment não encontrado: ${attachmentId}`);
    }

    const transaction = await this.transactionsRepository.findOne({ where: { id: transactionId } });
    if (!transaction) {
      throw new NotFoundException(`Transação não encontrada: ${transactionId}`);
    }

    // Verificar se transação já tem attachment
    const existingAttachment = await this.attachmentsRepository.findOne({
      where: { transaction: { id: transactionId } },
    });

    if (existingAttachment && existingAttachment.id !== attachmentId) {
      // Remover attachment antigo
      await this.delete(existingAttachment.id, userId);
    }

    attachment.transaction = transaction;
    return this.attachmentsRepository.save(attachment);
  }

  /**
   * Limpa attachments órfãos (sem transação associada há mais de 24h)
   */
  async cleanupOrphanedAttachments(): Promise<number> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const orphaned = await this.attachmentsRepository
      .createQueryBuilder('attachment')
      .leftJoin('attachment.transaction', 'transaction')
      .where('transaction.id IS NULL')
      .andWhere('attachment.createdAt < :oneDayAgo', { oneDayAgo })
      .getMany();

    let deleted = 0;
    for (const attachment of orphaned) {
      try {
        await this.delete(attachment.id);
        deleted++;
      } catch (error) {
        this.logger.warn(
          `Falha ao remover attachment órfão ${attachment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (deleted > 0) {
      this.logger.log(`Removidos ${deleted} attachments órfãos`);
    }

    return deleted;
  }
}
