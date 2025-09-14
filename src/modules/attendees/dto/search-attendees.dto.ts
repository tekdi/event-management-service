import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsNumber, Min, Max, IsArray, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class Search_Event_AttendeesDto {
  @ApiProperty({
    description: 'Array of user UUIDs (multiple users)',
    example: ['014b9a1b-cf76-4fee-8d14-f832bcac61b5', '024b9a1b-cf76-4fee-8d14-f832bcac61b6'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @ApiProperty({
    description: 'Array of event UUIDs (multiple events)',
    example: ['bfec8878-623d-40ff-90aa-9bcaf6a73602', 'cfec8878-623d-40ff-90aa-9bcaf6a73603'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  eventIds?: string[];

  @ApiProperty({
    description: 'The UUID of the event repetition',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  eventRepetitionId?: string;

  @ApiProperty({
    description: 'Number of records to skip (offset)',
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
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
