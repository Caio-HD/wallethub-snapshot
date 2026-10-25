import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageFactory } from './storage.factory';
import { STORAGE_SERVICE } from './storage.interface';
import { storageConfig } from '../../core/config/storage.config';

@Global()
@Module({
  imports: [ConfigModule.forFeature(storageConfig)],
  providers: [
    StorageFactory,
    {
      provide: STORAGE_SERVICE,
      useFactory: (factory: StorageFactory) => factory.createStorageService(),
      inject: [StorageFactory],
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
