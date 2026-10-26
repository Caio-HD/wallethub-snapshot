import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankEntity } from '../../database/entities/bank.entity.js';
import { BanksService } from './banks.service';
import { BanksController } from './banks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BankEntity])],
  providers: [BanksService],
  controllers: [BanksController],
  exports: [BanksService],
})
export class BanksModule {}
