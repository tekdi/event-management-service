import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SearchAttendeesDto {
  @ApiProperty({
    description: 'The UUID of the user',
    example: '014b9a1b-cf76-4fee-8d14-f832bcac61b5',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'The UUID of the event',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;
}
