import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
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

  // @ApiProperty({
  //     description: '',
  //     example: 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9'
  // })
  // @IsUUID()
  // userId: string;

  @ApiProperty({
    description: '',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsUUID()
  eventId: string;

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
}
