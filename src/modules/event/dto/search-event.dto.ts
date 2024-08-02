import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsDateString,
  IsEnum,
  IsString,
  ValidateNested,
  IsUUID,
} from 'class-validator';

export class FilterDto {
  @ApiProperty({
    example: '2024-07-24',
    description: 'specific date in YYYY-MM-DD format',
  })
  @IsOptional()
  @IsDateString()
  date: string;

  @ApiProperty({
    example: '2024-07-24',
    description: 'Start date in YYYY-MM-DD format',
  })
  @IsOptional()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2024-07-27',
    description: 'End date in YYYY-MM-DD format',
  })
  @IsOptional()
  @IsDateString()
  endDate: string;

  @ApiProperty({
    example: ['live', 'draft', 'inActive', 'archived'],
    description: 'Array of status values: live, draft, inActive,archived',
  })
  @IsOptional()
  @IsEnum(['live', 'draft', 'inActive', 'archived'], {
    each: true,
    message: 'Status must be one of: live, draft, inActive, archived',
  })
  status?: string[];

  @ApiProperty({
    example: ['online', 'offline'],
    description: 'Array of status values: online, offline',
  })
  @IsOptional()
  @IsEnum(['online', 'offline'], {
    each: true,
    message: 'Event Type must be one of: online, offline',
  })
  eventType?: string[];

  @ApiProperty({ example: 'Event Title', description: 'Event title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'CohortId', description: 'CohortId' })
  @IsOptional()
  @IsUUID('4')
  cohortId?: string
}

export class SearchFilterDto {
  @ApiProperty({
    type: Number,
    description: 'Limit',
  })
  limit: number;

  @ApiProperty({
    type: Number,
    description: 'Offset',
  })
  offset: number;

  @ApiProperty({ type: FilterDto, description: 'Filters for search' })
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filters: FilterDto;
}
