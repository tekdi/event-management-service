import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateAttendeesDto {
  @ApiProperty({
    description: 'The UUID of the user',
    example: '0050d1cb-64d0-4902-9ef0-a868aa7aa713',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The UUID of the event',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsUUID()
  eventId: string;

  @ApiProperty({
    type: String,
    description: 'Status',
    example: 'unpublished',
  })
  @IsEnum(['published', 'unpublished'], {
    message: 'Status must be one of: published, unpublished',
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  status: string;

  @ApiProperty({
    description: 'isAttended',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isAttended?: boolean;

  @ApiProperty({
    description: 'Duration',
    example: 2000,
  })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({
    description: 'joinedLeftHistory',
    example: {
      duration: 28,
      joinedDateTime: '2021-12-30 06:08:50.250',
      leftDateTime: '2021-12-30 06:09:18.393',
    },
  })
  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  joinedLeftHistory?: any;

  @ApiProperty({
    description: 'Additional parameters for the attendee',
    example: { customField: 'value', preferences: { notifications: true } },
    required: false,
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @IsOptional()
  updatedAt: Date;
}
