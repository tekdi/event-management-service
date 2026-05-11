import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LmsService } from './lms.service';

@Module({
  imports: [HttpModule],
  providers: [LmsService],
  exports: [LmsService],
})
export class LmsModule {}
