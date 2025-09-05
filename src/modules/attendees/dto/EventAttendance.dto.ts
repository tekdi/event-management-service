import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  min,
} from 'class-validator';
import { UUID } from 'crypto';

export class EventAttendeesDTO {
  eventAttendeesId?: string;

  @ApiProperty({
    description: '',
    example: 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: '',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsUUID()
  eventId: string;

  @ApiProperty({
    description: '',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsUUID()
  eventRepetitionId: string;

  @ApiProperty({
    type: String,
    description: 'Status',
    example: 'published',
  })
  @IsEnum(['published', 'unpublished'], {
    message: 'Status must be one of: published, unpublished',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @IsUUID()
  @IsOptional()
  enrolledBy?: string;

  @ApiProperty({
    description: 'Additional parameters for the attendee',
    example: { customField: 'value', preferences: { notifications: true } },
    required: false,
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @ApiProperty({
    description: 'Enrolled at',
    example: '2021-01-01T00:00:00.000Z',
  })
  @IsDate()
  @IsOptional()
  enrolledAt: Date;

  @ApiProperty({
    description: 'Registrant ID from the meeting provider',
    example: 'ADU1GG66TEWMdBy9_yUyQg',
  })
  @IsString()
  @IsOptional()
  registrantId?: string;

}
