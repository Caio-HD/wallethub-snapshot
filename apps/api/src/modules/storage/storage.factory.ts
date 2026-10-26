import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { MinIOStorageService } from './minio-storage.service';

export type StorageType = 'local' | 's3' | 'minio';

@Injectable()
export class StorageFactory {
  private readonly logger = new Logger(StorageFactory.name);

  constructor(private readonly configService: ConfigService) {}

  createStorageService(): StorageService {
    const storageType = (
      this.configService.get<string>('storage.type') || 'local'
    ).toLowerCase() as StorageType;

    this.logger.log(`Criando serviço de storage: ${storageType}`);

    switch (storageType) {
      case 'local':
        return new LocalStorageService(this.configService);

      case 's3':
        return new S3StorageService(this.configService);

      case 'minio':
        return new MinIOStorageService(this.configService);

      default:
        this.logger.warn(
          `Tipo de storage desconhecido: ${String(storageType)}, usando local como fallback`,
        );
        return new LocalStorageService(this.configService);
    }
  }
}
