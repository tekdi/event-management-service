import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AttendanceJobStatus } from '../entities/attendance-job.entity';

export class ListAttendanceJobsDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Specific job ID to retrieve (BullMQ jobId or UUID). If provided, other filters are ignored.',
  })
  @IsOptional()
  @IsString()
  jobId?: string;

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
    example: 'bulk-import',
    description:
      'Filter by context label (exact match). Defaults to bulk-import in the bulk-import API.',
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
