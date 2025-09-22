import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, IsBoolean, Min, Max, IsDateString } from 'class-validator';

export class MarkMeetingAttendanceDto {
  @ApiProperty({
    type: String,
    description: 'Mark attendance by email or username',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsEnum(['email', 'username'], {
    message: 'Attendance can marked on basis of email or name',
  })
  @IsNotEmpty()
  markAttendanceBy: string;

  @ApiProperty({
    type: String,
    description: 'Meeting ID',
    example: '1234567890',
  })
  @IsString()
  @IsOptional()
  meetingId: string;

  @ApiProperty({
    type: String,
    description: 'Event ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  eventRepetitionId: string;

  @ApiProperty({
    type: String,
    description: 'The date of the attendance in format yyyy-mm-dd',
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Please provide a valid date in the format yyyy-mm-dd',
  })
  attendanceDate: string;

  @ApiProperty({
    type: String,
    description: 'Scope of the attendance',
    example: 'self / student',
  })
  @IsString()
  @IsNotEmpty()
  scope: string;

  @ApiProperty({
    type: String,
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({
    type: Number,
    description: 'Page size',
    example: 300,
  })
  @IsNumber()
  @IsOptional()
  pageSize: number;
}

export class MarkAttendanceDto {
  @ApiProperty({
    description: 'Event repetition ID to mark attendance for (optional - if not provided, will process all ended events)',
    example: 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9',
    required: false
  })
  @IsOptional()
  @IsUUID('4')
  eventRepetitionId?: string;


  @ApiProperty({
    description: 'Page size for Zoom API calls (max 300)',
    example: 300,
    default: 300
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(300)
  pageSize?: number = 300;

  @ApiProperty({
    description: 'Force re-process even if attendance already marked',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  forceReprocess?: boolean = false;

  @ApiProperty({
    description: 'Mark attendance by registrant ID (matches EventAttendees.registrantId with Zoom participant registrant_id)',
    example: 'registrant_id',
    default: 'registrant_id'
  })
  @IsOptional()
  @IsEnum(['registrant_id'])
  markBy?: 'registrant_id' = 'registrant_id';

}