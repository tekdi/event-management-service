import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsString,
  ValidateNested,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsIn,
} from 'class-validator';

// DateRangeDto for specifying date range filters
class DateRangeDto {
  @ApiProperty({
    example: '2024-07-24T00:00:00Z',
    description:
      'ISO 8601 format date-time representing the start of the range',
  })
  @IsOptional()
  @IsDateString()
  after?: string;

  @ApiProperty({
    example: '2024-07-27T23:59:59Z',
    description: 'ISO 8601 format date-time representing the end of the range',
  })
  @IsOptional()
  @IsDateString()
  before?: string;
}
export class FilterDto {
  @ApiProperty({ type: DateRangeDto, description: 'Start date range filter' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  date?: DateRangeDto;

  @ApiProperty({ type: DateRangeDto, description: 'Start date range filter' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  startDate?: DateRangeDto;

  @ApiProperty({ type: DateRangeDto, description: 'End date range filter' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  endDate?: DateRangeDto;
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

  @ApiProperty({
    example: '76a5e84a-4336-47c8-986f-98f7ad190e0b',
    description: 'Cohort',
  })
  @IsOptional()
  @IsUUID('4')
  cohortId?: string;

  @ApiProperty({
    example: true,
    description:
      'Filter by pathway events (metadata.isPathway). When true, returns only events with metadata.isPathway === true.',
  })
  @IsOptional()
  @IsBoolean()
  isPathway?: boolean;

  @ApiProperty({
    example: 'eff008a8-2573-466d-b877-fddf6a4fc13e',
    description: 'CreatedBy',
  })
  @IsOptional()
  @IsUUID('4')
  createdBy?: string;
}

const EVENT_LIST_SORT_COLUMNS = ['startDateTime', 'endDateTime'] as const;

export class EventListSortDto {
  @ApiProperty({
    example: 'startDateTime',
    description: 'Column on EventRepetition to sort by',
    enum: EVENT_LIST_SORT_COLUMNS,
  })
  @IsIn(EVENT_LIST_SORT_COLUMNS)
  column: (typeof EVENT_LIST_SORT_COLUMNS)[number];

  @ApiProperty({
    example: 'ASC',
    description: 'Sort direction (defaults to ASC)',
    enum: ['ASC', 'DESC'],
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value == null || value === '' ? 'ASC' : String(value).toUpperCase(),
  )
  @IsIn(['ASC', 'DESC'])
  order?: string;
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

  @ApiProperty({
    type: EventListSortDto,
    description: 'Sort by EventRepetition occurrence time (default startDateTime ASC)',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EventListSortDto)
  sort?: EventListSortDto;
}
