import { Global, Module } from '@nestjs/common';
import { ElevatedAccessService } from './elevated-access.service';
import { ElevatedAccessGuard } from './elevated-access.guard';

/**
 * Global so both the organizations module (impersonation bypass) and the admin module
 * (platform console) can consume the same elevated-access decision.
 */
@Global()
@Module({
  providers: [ElevatedAccessService, ElevatedAccessGuard],
  exports: [ElevatedAccessService, ElevatedAccessGuard],
})
export class SecurityModule {}
