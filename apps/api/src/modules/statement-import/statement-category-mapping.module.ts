import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatementCategoryMappingService } from './statement-category-mapping.service';
import { StatementCategoryMappingEntity } from '../../database/entities/statement-category-mapping.entity.js';

/**
 * Memória descrição→categoria (loop de aprendizado). Módulo próprio para ser
 * compartilhado por StatementImport (aplica o mapa) e Transactions (aprende ao
 * categorizar) sem dependência circular.
 */
@Module({
  imports: [TypeOrmModule.forFeature([StatementCategoryMappingEntity])],
  providers: [StatementCategoryMappingService],
  exports: [StatementCategoryMappingService],
})
export class StatementCategoryMappingModule {}
