import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, IsBoolean, Min, Max, IsDateString, IsArray, ArrayMinSize } from 'class-validator';
import { Transform } from 'class-transformer';

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

/**
 * DTO for marking attendance via background job queue
 * Supports both single event and bulk processing
 */
export class MarkAttendanceDto {
  @ApiProperty({
    type: String,
    description:
      'Event Repetition ID (optional - if not provided, processes all ended events)',
    example: 'abc-123-def',
    required: false,
  })
  @Transform(({ value }) => {
    // Remove quotes if present (form-data sometimes includes quotes)
    if (typeof value === 'string') {
      return value.replace(/^"|"$/g, '').trim();
    }
    return value;
  })
  @IsUUID()
  @IsOptional()
  eventRepetitionId?: string;

  @ApiProperty({
    type: Boolean,
    description:
      'Use mock data instead of real Zoom API (for testing). If true, mockDataFile must be provided. Accepts boolean or string "true"/"false".',
    example: false,
    required: false,
  })
  @Transform(({ value }) => {
    // Convert string "true"/"false" to boolean (form-data sends strings)
    if (value === 'true' || value === true || value === '1' || value === 1) {
      return true;
    }
    if (value === 'false' || value === false || value === '0' || value === 0 || value === '') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  @IsOptional()
  useMockData?: boolean;

  @ApiProperty({
    type: String,
    description:
      'JSON file name in data/mock-json/ directory to use for mock data. Required if useMockData is true and no file is uploaded.',
    example: 'webinar-participants.json',
    required: false,
  })
  @IsString()
  @IsOptional()
  mockDataFile?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Upload JSON file for mock data. If provided, this file will be saved and used instead of mockDataFile parameter.',
    required: false,
  })
  mockDataFileUpload?: any; // For Swagger documentation only
}

export class MarkAttendanceDtoOld {
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

/**
 * DTO for marking attendance by userId directly (without Zoom API)
 * This API is designed for Postman runner testing and manual attendance marking
 */
export class MarkAttendanceByUsernameDto {
  @ApiProperty({
    type: [String],
    description: 'Array of user IDs (UUIDs) to mark attendance for',
    example: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001', '323e4567-e89b-12d3-a456-426614174002'],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one userId is required' })
  @IsUUID('4', { each: true, message: 'Each userId must be a valid UUID' })
  @IsNotEmpty()
  userIds: string[];

  @ApiProperty({
    type: String,
    description: 'Event Repetition ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  eventRepetitionId: string;

  @ApiProperty({
    type: String,
    description: 'Event ID (UUID) - used for LMS lesson completion',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    type: String,
    description: 'The date of the attendance in format yyyy-mm-dd',
    example: '2024-01-15',
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Please provide a valid date in the format yyyy-mm-dd',
  })
  attendanceDate: string;

  @ApiProperty({
    type: String,
    description: 'Scope of the attendance',
    example: 'student',
  })
  @IsString()
  @IsNotEmpty()
  scope: string;

  @ApiProperty({
    type: String,
    description: 'Tenant ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({
    type: Number,
    description: 'Time spent in seconds (optional, defaults to 0)',
    example: 3600,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  timeSpent?: number = 0;
}