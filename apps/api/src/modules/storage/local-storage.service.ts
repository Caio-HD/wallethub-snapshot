import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StorageService } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly storageRoot: string;

  constructor(private readonly configService: ConfigService) {
    this.storageRoot =
      this.configService.get<string>('storage.local.path') || '/var/storage/wallethub';
    this.ensureStorageDirectory().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao criar diretório de storage: ${message}`);
    });
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageRoot, { recursive: true, mode: 0o700 });
    } catch {
      this.logger.warn(`Diretório de storage pode não estar acessível: ${this.storageRoot}`);
    }
  }

  async saveFile(buffer: Buffer, fileName: string, _mimeType: string): Promise<string> {
    await this.ensureStorageDirectory();

    // Gerar nome único baseado em UUID e manter extensão original
    const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
    const uniqueFileName = `${randomUUID()}${ext ? '.' + ext : ''}`;
    const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    const storagePath = join(datePrefix, uniqueFileName);
    const fullPath = join(this.storageRoot, storagePath);

    // Criar diretório se não existir
    await fs.mkdir(dirname(fullPath), { recursive: true, mode: 0o700 });

    // Salvar arquivo
    await fs.writeFile(fullPath, buffer, { mode: 0o600 });

    this.logger.debug(`Arquivo salvo: ${storagePath}`);
    return storagePath;
  }

  async getFile(
    storagePath: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const fullPath = join(this.storageRoot, storagePath);

    // Verificar se arquivo existe
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(`Arquivo não encontrado: ${storagePath}`);
    }

    const buffer = await fs.readFile(fullPath);

    // Tentar inferir MIME type e nome do arquivo do caminho
    const fileName = storagePath.split('/').pop() || 'file';
    const mimeType = this.inferMimeType(fileName);

    return { buffer, mimeType, fileName };
  }

  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = join(this.storageRoot, storagePath);

    try {
      await fs.unlink(fullPath);
      this.logger.debug(`Arquivo removido: ${storagePath}`);
    } catch (error) {
      // Ignorar erro se arquivo não existir
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(storagePath: string): Promise<boolean> {
    const fullPath = join(this.storageRoot, storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  private inferMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      txt: 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
