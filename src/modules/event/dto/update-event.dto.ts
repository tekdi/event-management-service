import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsLongitude,
  IsLatitude,
  IsBoolean,
  IsInt,
  Min,
  IsDateString,
  IsObject,
  ValidateIf,
  ValidateNested,
  Validate,
} from 'class-validator';
import { MeetingDetails } from 'src/common/utils/types';
import { Type } from 'class-transformer';
import { UrlWithProviderValidator } from 'src/common/utils/validation.util';
export interface UpdateResult {
  onlineDetails?: any;
  erMetaData?: any;
  eventDetails?: any;
  repetationDetail?: any;
  recurrenceUpdate?: any;
}
export class UpdateMeetingDetailsDto {
  // Pass the provider from the parent DTO
  onlineProvider: string;

  @ApiProperty({ description: 'Meeting ID', example: 94292617 })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  id: string;

  @ApiProperty({
    description: 'Meeting url',
    example: 'https://example.com/meeting',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @Validate(UrlWithProviderValidator)
  url: string;

  @ApiProperty({ description: 'Meeting password', example: 'xxxxxx' })
  @IsString()
  @IsOptional()
  password: string;

  @ApiProperty({
    type: String,
    description: 'providerGenerated',
    default: false,
  })
  providerGenerated: boolean;
}
export class UpdateEventDto {
  @ApiProperty({
    type: String,
    description: 'Status',
    example: 'live',
  })
  @IsEnum(['live', 'draft', 'archived'], {
    message: 'Status must be one of: live, draft, archived',
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiProperty({
    type: String,
    description: 'title',
    example: 'Sample Event',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @ApiProperty({
    type: String,
    description: 'isRecurring',
    example: true,
  })
  @IsBoolean()
  isMainEvent: boolean;

  @ApiProperty({
    type: UpdateMeetingDetailsDto,
    description: 'Online Meeting Details',
    example: {
      url: 'https://example.com/meeting',
      id: '123-456-789',
      password: 'xxxxxxx',
    },
  })
  @IsObject()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateMeetingDetailsDto)
  onlineDetails: MeetingDetails;

  @ApiProperty({
    description: 'MetaData Details',
    example: {
      topic: 'Java',
      mentorId: '1244546647',
      subTopic: 'Type of fetaures',
    },
  })
  @IsObject()
  @IsOptional()
  erMetaData: any;

  @ApiProperty({
    type: String,
    description: 'Start Datetime',
    example: '2024-06-02T02:00:00Z',
  })
  @ValidateIf((o) => o.endDatetime !== undefined)
  @IsDateString()
  startDatetime: Date;

  @ApiProperty({
    type: String,
    description: 'End Datetime',
    example: '2024-06-02T05:00:00Z',
  })
  @ValidateIf((o) => o.startDatetime !== undefined)
  @IsDateString()
  endDatetime: Date;

  @ApiProperty({
    type: String,
    description: 'Location',
    example: 'Event Location',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  location: string;

  @ApiProperty({
    type: Number,
    description: 'Latitude',
    example: 18.508345134886994,
  })
  @ValidateIf((o) => o.latitude !== undefined)
  @IsLongitude()
  longitude: number;

  @ApiProperty({
    type: Number,
    description: 'Latitude',
    example: 18.508345134886994,
  })
  @ValidateIf((o) => o.longitude !== undefined)
  @IsLatitude()
  latitude: number;

  @IsString()
  @IsOptional()
  createdBy: string;

  @IsString()
  @IsOptional()
  updatedBy: string;

  @IsOptional()
  updateAt: Date;

  // Validation to ensure if isMainEvent is true, title or status must be provided
  @ValidateIf(
    (o) =>
      !o.title &&
      !o.status &&
      !o.onlineDetails &&
      !o.location &&
      !o.latitude &&
      !o.erMetaData &&
      !o.startDatetime,
  )
  @IsNotEmpty({
    message:
      'If isMainEvent is provided, at least one of title or status must be provided.',
  })
  dummyField?: any;
}
