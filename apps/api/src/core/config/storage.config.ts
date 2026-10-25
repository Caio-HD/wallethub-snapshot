import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  type: 'local' | 's3' | 'minio';
  local: {
    path: string;
  };
  s3: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  minio: {
    bucket: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  maxFileSize: number;
  allowedMimeTypes: string[];
}

const defaultMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

export const storageConfig = registerAs('storage', (): StorageConfig => {
  const allowed = process.env.STORAGE_ALLOWED_MIME_TYPES;
  return {
    type: (process.env.STORAGE_TYPE?.toLowerCase() as StorageConfig['type']) || 'local',
    local: {
      path: process.env.STORAGE_LOCAL_PATH ?? './storage',
    },
    s3: {
      bucket: process.env.STORAGE_S3_BUCKET ?? '',
      region: process.env.STORAGE_S3_REGION ?? 'us-east-1',
      endpoint: process.env.STORAGE_S3_ENDPOINT,
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
    },
    minio: {
      bucket: process.env.STORAGE_MINIO_BUCKET ?? '',
      endpoint: process.env.STORAGE_MINIO_ENDPOINT,
      accessKeyId: process.env.STORAGE_MINIO_ACCESS_KEY,
      secretAccessKey: process.env.STORAGE_MINIO_SECRET_KEY,
    },
    maxFileSize: Number(process.env.STORAGE_MAX_FILE_SIZE) || 10 * 1024 * 1024,
    allowedMimeTypes: allowed ? allowed.split(',').map((s) => s.trim()) : defaultMimeTypes,
  };
});
