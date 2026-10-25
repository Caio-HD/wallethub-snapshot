import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoryEntity } from '../../database/entities/category.entity.js';
import { TransactionEntity } from '../../database/entities/transaction.entity.js';
import { OrganizationMembershipEntity } from '../../database/entities/organization-membership.entity.js';
import { UsersModule } from '../users/users.module';
import { CategorySuggestionService } from './category-suggestion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CategoryEntity, TransactionEntity, OrganizationMembershipEntity]),
    UsersModule,
  ],
  providers: [CategoriesService, CategorySuggestionService],
  controllers: [CategoriesController],
  exports: [CategoriesService, CategorySuggestionService],
})
export class CategoriesModule {}
