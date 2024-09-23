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
  IsIn,
} from 'class-validator';
import { MeetingDetails } from 'src/common/utils/types';
import { Transform, Type } from 'class-transformer';

import { UrlWithProviderValidator } from 'src/common/utils/validation.util';
import { RecurrencePatternDto } from './create-event.dto';
import { MeetingDetailsDto } from './create-event.dto';

export interface UpdateResult {
  onlineDetails?: any;
  erMetaData?: any;
  eventDetails?: any;
  repetationDetail?: any;
  recurrenceUpdate?: any;
  updatedRecurringEvent?: any;
  updatedEventDetails?: any;
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
    type: MeetingDetailsDto,
    description: 'Online Meeting Details',
    example: {
      url: 'https://example.com/meeting',
      id: '123-456-789',
      password: 'xxxxxxx',
    },
  })
  @IsObject()
  // @ValidateIf((o => o.onlineProvider != undefined))
  @ValidateIf(
    (o) => o.onlineProvider != undefined || o.onlineDetails != undefined,
  )
  // @ValidateIf((o => o.onlineProvider != undefined))
  @ValidateIf(
    (o) => o.onlineProvider != undefined || o.onlineDetails != undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => MeetingDetailsDto)
  @Transform(({ value, obj }) => {
    value.onlineProvider = obj.onlineProvider; // Pass the provider to the nested DTO
    return value;
  })
  @Type(() => MeetingDetailsDto)
  @Transform(({ value, obj }) => {
    value.onlineProvider = obj.onlineProvider; // Pass the provider to the nested DTO
    return value;
  })
  onlineDetails: MeetingDetails;

  @ApiProperty({
    description: 'ErMetaData Details',
    example: {
      framework: {
        board: '',
        medium: '',
        grade: '',
        subject: '',
        topic: '',
        subTopic: '',
        teacherName: 'Vivek Kasture',
      },
      eventType: 'PLANNED_SESSION',
      doId: '',
      cohortId: '71bdbed4-388a-4c79-bd69-65b08e857f1e',
      cycleId: '',
      tenant: '',
    },
  })
  @IsObject()
  @IsOptional()
  erMetaData: any;

  @ApiProperty({
    description: 'MetaData Details',
    example: {
      framework: {
        board: '',
        medium: '',
        grade: '',
        subject: '',
        topic: '',
        subTopic: '',
        teacherName: 'Vivek Kasture',
      },
      eventType: 'PLANNED_SESSION',
      doId: '',
      cohortId: '71bdbed4-388a-4c79-bd69-65b08e857f1e',
      cycleId: '',
      tenant: '',
    },
  })
  @IsObject()
  @IsOptional()
  metadata: any;

  @ApiProperty({
    type: String,
    description: 'Start Datetime',
    example: '2024-06-02T02:00:00Z',
  })
  @ValidateIf((o) => o.endDatetime !== undefined)
  @IsDateString()
  startDatetime: string;

  @ApiProperty({
    type: String,
    description: 'End Datetime',
    example: '2024-06-02T05:00:00Z',
  })
  @ValidateIf((o) => o.startDatetime !== undefined)
  @IsDateString()
  endDatetime: string;

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

  @ApiProperty({
    type: RecurrencePatternDto,
    description: 'recurrencePattern',
    example: { frequency: 'daily', interval: 1 },
  })
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => RecurrencePatternDto)
  @ApiProperty({
    type: RecurrencePatternDto,
    description: 'recurrencePattern',
    example: { frequency: 'daily', interval: 1 },
  })
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => RecurrencePatternDto)
  @IsOptional()
  recurrencePattern: RecurrencePatternDto;

  @ApiProperty({
    type: String,
    description: 'Online Provider',
    example: 'Zoom',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(['Zoom', 'GoogleMeet'])
  onlineProvider: string;

  //   @IsString()
  //   @IsOptional()
  //   createdBy: string;

  @ApiProperty({
    type: String,
    description: 'updatedBy',
    example: 'eff008a8-2573-466d-b877-fddf6a4fc13e',
  })
  @IsString()
  //   @IsOptional()
  updatedBy: string;

  @IsOptional()
  updateAt: Date;

  isRecurring: boolean;

  // Validation to ensure if isMainEvent is true, title or status must be provided
  @ValidateIf(
    (o) =>
      !o.title &&
      !o.status &&
      !o.onlineDetails &&
      !o.location &&
      !o.latitude &&
      !o.erMetaData &&
      !o.startDatetime &&
      !o.onlineProvider,
  )
  @IsNotEmpty({
    message:
      'If isMainEvent is provided, at least one of title or status must be provided.',
  })
  validateFields?: any;
}
