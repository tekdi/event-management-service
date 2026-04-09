import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AttendanceJobStatus } from '../entities/attendance-job.entity';

export class ListAttendanceJobsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  eventRepetitionId?: string;

  @ApiPropertyOptional({ enum: AttendanceJobStatus })
  @IsOptional()
  @IsEnum(AttendanceJobStatus)
  status?: AttendanceJobStatus;

  @ApiPropertyOptional({
    type: String,
    example: 'LMS_Event',
    description:
      'Filter by context label (exact match). Any string (DB stores up to 255 chars).',
  })
  @IsOptional()
  @IsString()
  contextType?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
