import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ConfigController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [ConfigController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
