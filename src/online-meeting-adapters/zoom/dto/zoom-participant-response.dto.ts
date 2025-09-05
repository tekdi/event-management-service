import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ZoomParticipantResponseDto {
  @ApiProperty({
    description: 'Array of participants from Zoom API',
    example: [
      {
        id: 'user1@example.com',
        user_id: '123456789',
        name: 'John Doe',
        user_email: 'user1@example.com',
        join_time: '2023-01-01T10:00:00Z',
        leave_time: '2023-01-01T11:00:00Z',
        duration: 3600,
        status: 'in_meeting',
      },
    ],
    type: [Object],
  })
  @IsArray()
  participants: any[];

  @ApiProperty({
    description: 'Token for fetching the next page of results',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
    required: false,
  })
  @IsOptional()
  @IsString()
  next_page_token?: string;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  @IsNumber()
  page_count: number;

  @ApiProperty({
    description: 'Number of records per page',
    example: 300,
  })
  @IsNumber()
  page_size: number;

  @ApiProperty({
    description: 'Total number of records available',
    example: 100000,
  })
  @IsNumber()
  total_records: number;
}