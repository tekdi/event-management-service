import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

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
  @IsNotEmpty()
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
}
