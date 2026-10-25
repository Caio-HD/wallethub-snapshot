import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderEntity } from '../../database/entities/reminder.entity';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersCronService } from './reminders.cron';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReminderEntity]), AlertsModule, OrganizationsModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersCronService],
  exports: [RemindersService],
})
export class RemindersModule {}
