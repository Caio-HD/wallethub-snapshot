import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AttachmentsService } from '@app/modules/attachments/attachments.service';
import { AttachmentEntity } from '@app/database/entities/attachment.entity';
import { TransactionEntity } from '@app/database/entities/transaction.entity';
import { StorageService, STORAGE_SERVICE } from '@app/modules/storage/storage.interface';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let _attachmentsRepository: Repository<AttachmentEntity>;
  let _transactionsRepository: Repository<TransactionEntity>;
  let _storageService: StorageService;
  let _configService: ConfigService;

  const mockStorageService: Partial<StorageService> = {
    saveFile: jest.fn().mockResolvedValue('path/to/file'),
    getFile: jest.fn().mockResolvedValue({
      buffer: Buffer.from('test'),
      mimeType: 'image/jpeg',
      fileName: 'test.jpg',
    }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    fileExists: jest.fn().mockResolvedValue(true),
  };

  const mockAttachmentsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTransactionsRepository = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'storage.maxFileSize') return 10 * 1024 * 1024;
      if (key === 'storage.allowedMimeTypes') return ['image/jpeg', 'image/png', 'application/pdf'];
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: getRepositoryToken(AttachmentEntity),
          useValue: mockAttachmentsRepository,
        },
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: mockTransactionsRepository,
        },
        {
          provide: STORAGE_SERVICE,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
    _attachmentsRepository = module.get<Repository<AttachmentEntity>>(
      getRepositoryToken(AttachmentEntity),
    );
    _transactionsRepository = module.get<Repository<TransactionEntity>>(
      getRepositoryToken(TransactionEntity),
    );
    _storageService = module.get<StorageService>(STORAGE_SERVICE);
    _configService = module.get<ConfigService>(ConfigService);
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('deve salvar arquivo válido', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
      } as Express.Multer.File;

      const attachment = { id: '123', fileName: 'test.jpg' } as AttachmentEntity;
      mockAttachmentsRepository.create.mockReturnValue(attachment);
      mockAttachmentsRepository.save.mockResolvedValue(attachment);

      const result = await service.upload(file, undefined, undefined);

      expect(mockStorageService.saveFile).toHaveBeenCalledWith(
        file.buffer,
        file.originalname,
        file.mimetype,
      );
      expect(mockAttachmentsRepository.save).toHaveBeenCalled();
      expect(result).toEqual(attachment);
    });

    it('deve rejeitar arquivo muito grande', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 20 * 1024 * 1024, // 20MB
      } as Express.Multer.File;

      await expect(
        service.upload(file, undefined, undefined),
      ).rejects.toThrow('Arquivo muito grande');
    });

    it('deve rejeitar tipo MIME não permitido', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
      } as Express.Multer.File;

      await expect(
        service.upload(file, undefined, undefined),
      ).rejects.toThrow('Tipo de arquivo não permitido');
    });
  });
});
