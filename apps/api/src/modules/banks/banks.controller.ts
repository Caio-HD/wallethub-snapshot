import { Controller, Get, UseGuards } from '@nestjs/common';
import { BanksService } from './banks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** Catálogo de bancos (referência) — qualquer utilizador autenticado pode consultar. */
@Controller('banks')
@UseGuards(JwtAuthGuard)
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get()
  findAll() {
    return this.banksService.findAllActive();
  }
}
