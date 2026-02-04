import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsString,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class EventAttendanceReportDto {
  @ApiProperty({
    description:
      'Event ID(s) to filter by. Can be a single eventId or array of eventIds',
    example: 'aa429f8e-890d-4be8-a7bf-f64b55951e40',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    required: true,
  })
  @Transform(({ value }) => {
    // If it's already an array, return it
    if (Array.isArray(value)) {
      return value;
    }
    // If it's a single string, convert to array
    if (typeof value === 'string') {
      return [value];
    }
    // If it's undefined or null, return empty array (will be caught by validation)
    return [];
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  eventIds: string[];

  @ApiProperty({
    description: 'Pagination offset (default: 0)',
    example: 0,
    minimum: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiProperty({
    description: 'Pagination limit (default: 10)',
    example: 10,
    minimum: 1,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Field to sort by',
    enum: ['userId', 'firstName', 'lastName'],
    example: 'userId',
    required: false,
    default: 'userId',
  })
  @IsOptional()
  @IsString()
  @IsIn(['userId', 'firstName', 'lastName'])
  sortBy?: string = 'userId';

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'asc',
    required: false,
    default: 'asc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  orderBy?: string = 'asc';

  @ApiProperty({
    description:
      'Filter by attendance status. true = attended, false = not attended',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return true; // Default to true
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      return lowerValue === 'true' || lowerValue === '1';
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return true; // Default to true
  })
  @IsBoolean()
  attended?: boolean;
}
