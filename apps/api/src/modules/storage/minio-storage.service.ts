import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';

/**
 * Implementação de storage usando MinIO (compatível com S3)
 *
 * Esta é uma extensão do S3StorageService configurada para MinIO.
 * Requer variáveis de ambiente:
 * - STORAGE_MINIO_BUCKET: Nome do bucket
 * - STORAGE_MINIO_ENDPOINT: Endpoint do MinIO (ex: http://minio:9000)
 * - STORAGE_MINIO_ACCESS_KEY: Chave de acesso
 * - STORAGE_MINIO_SECRET_KEY: Chave secreta
 * - STORAGE_MINIO_REGION: Região (opcional, padrão: us-east-1)
 */
@Injectable()
export class MinIOStorageService extends S3StorageService {
  private readonly minioConfig:
    | {
        bucket?: string;
        region?: string;
        endpoint?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
      }
    | undefined;

  constructor(configService: ConfigService) {
    super(configService);
    // Sobrescrever propriedades para usar configuração MinIO
    this.minioConfig = configService.get<{
      bucket?: string;
      region?: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    }>('storage.minio');
    if (this.minioConfig) {
      (this as unknown as { bucket: string }).bucket = this.minioConfig.bucket ?? '';
      (this as unknown as { region: string }).region = this.minioConfig.region ?? 'us-east-1';
      (this as unknown as { endpoint?: string }).endpoint = this.minioConfig.endpoint;
    }
    this.logger.log('Usando MinIO como storage backend');
  }

  // Sobrescrever getS3Client para usar credenciais MinIO
  protected override async getS3Client(): Promise<import('@aws-sdk/client-s3').S3Client> {
    const self = this as unknown as { s3Client: import('@aws-sdk/client-s3').S3Client | null };
    if (self.s3Client) {
      return self.s3Client;
    }

    try {
      const { S3Client } = await import('@aws-sdk/client-s3');

      const credentials = {
        accessKeyId:
          this.minioConfig?.accessKeyId ||
          this.configService.getOrThrow<string>('storage.minio.accessKeyId'),
        secretAccessKey:
          this.minioConfig?.secretAccessKey ||
          this.configService.getOrThrow<string>('storage.minio.secretAccessKey'),
      };

      self.s3Client = new S3Client({
        region: (this as unknown as { region: string }).region,
        endpoint: (this as unknown as { endpoint?: string }).endpoint,
        credentials,
        forcePathStyle: true, // Necessário para MinIO
      });

      return self.s3Client;
    } catch {
      this.logger.error(
        'Falha ao carregar @aws-sdk/client-s3. Instale: npm install @aws-sdk/client-s3',
      );
      throw new Error('MinIO storage não disponível: dependência @aws-sdk/client-s3 não instalada');
    }
  }
}
