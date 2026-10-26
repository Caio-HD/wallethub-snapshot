import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { StorageService } from './storage.interface';

/**
 * Implementação de storage usando AWS S3
 *
 * Requer variáveis de ambiente:
 * - STORAGE_S3_BUCKET: Nome do bucket
 * - AWS_ACCESS_KEY_ID: Chave de acesso AWS
 * - AWS_SECRET_ACCESS_KEY: Chave secreta AWS
 * - AWS_REGION: Região AWS (opcional, padrão: us-east-1)
 * - STORAGE_S3_ENDPOINT: Endpoint customizado (opcional, para MinIO ou S3-compatible)
 */
@Injectable()
export class S3StorageService implements StorageService {
  protected readonly logger = new Logger(S3StorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private s3Client: Awaited<ReturnType<typeof this.getS3Client>> | null = null; // Lazy-loaded

  constructor(protected readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('storage.s3.bucket');
    this.region = this.configService.get<string>('storage.s3.region') || 'us-east-1';
    this.endpoint = this.configService.get<string>('storage.s3.endpoint');
  }

  protected async getS3Client(): Promise<import('@aws-sdk/client-s3').S3Client> {
    if (this.s3Client) {
      return this.s3Client;
    }

    // Lazy load @aws-sdk/client-s3 apenas se necessário
    try {
      const { S3Client } = await import('@aws-sdk/client-s3');

      const s3Config = this.configService.get<{
        accessKeyId?: string;
        secretAccessKey?: string;
      }>('storage.s3');
      const credentials = {
        accessKeyId:
          s3Config?.accessKeyId ?? this.configService.getOrThrow<string>('storage.s3.accessKeyId'),
        secretAccessKey:
          s3Config?.secretAccessKey ??
          this.configService.getOrThrow<string>('storage.s3.secretAccessKey'),
      };

      this.s3Client = new S3Client({
        region: this.region,
        endpoint: this.endpoint,
        credentials,
        forcePathStyle: !!this.endpoint, // Necessário para MinIO
      });

      return this.s3Client;
    } catch {
      this.logger.error(
        'Falha ao carregar @aws-sdk/client-s3. Instale: npm install @aws-sdk/client-s3',
      );
      throw new Error('S3 storage não disponível: dependência @aws-sdk/client-s3 não instalada');
    }
  }

  async saveFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const client = await this.getS3Client();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
    const uniqueFileName = `${randomUUID()}${ext ? '.' + ext : ''}`;
    const storagePath = `${datePrefix}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalFileName: fileName,
      },
    });

    await client.send(command);
    this.logger.debug(`Arquivo salvo no S3: ${storagePath}`);
    return storagePath;
  }

  async getFile(
    storagePath: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const client = await this.getS3Client();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    const response = await client.send(command);
    const chunks: Uint8Array[] = [];

    if (!response.Body) {
      throw new Error(`Arquivo não encontrado no S3: ${storagePath}`);
    }

    // Converter stream para buffer
    if (
      response.Body &&
      typeof response.Body === 'object' &&
      Symbol.asyncIterator in response.Body
    ) {
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
    } else {
      throw new Error('Resposta do S3 não contém stream válido');
    }

    const buffer = Buffer.concat(chunks);
    const mimeType = response.ContentType || 'application/octet-stream';
    const fileName = response.Metadata?.originalFileName || storagePath.split('/').pop() || 'file';

    return { buffer, mimeType, fileName };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const client = await this.getS3Client();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    await client.send(command);
    this.logger.debug(`Arquivo removido do S3: ${storagePath}`);
  }

  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const client = await this.getS3Client();
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });

      await client.send(command);
      return true;
    } catch (error) {
      const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (awsError.name === 'NotFound' || awsError.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}
