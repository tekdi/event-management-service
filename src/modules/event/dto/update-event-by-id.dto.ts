import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsLongitude,
  IsLatitude,
  IsBoolean,
  IsDateString,
  IsObject,
  ValidateIf,
  ValidateNested,
  IsIn,
  IsInt,
  Min,
  IsArray,
  ArrayMaxSize,
  IsUUID,
  Validate,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { RecurrencePatternDto, MeetingDetailsDto } from './create-event.dto';
import { MeetingType, ApprovalType, EventTypes } from 'src/common/utils/types';
import { EndsWithZConstraint } from 'src/common/pipes/event-validation.pipe';

export interface UpdateEventByIdResult {
  eventUpdated?: boolean;
  eventDetails?: any;
  onlineDetails?: any;
  recurrencePattern?: any;
  updatedEvent?: any;
  platformIntegrationResult?: any;
}

export class UpdateEventByIdDto {
  @ApiProperty({
    type: String,
    description: 'Event title',
    example: 'Updated Event Title',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @ApiProperty({
    type: String,
    description: 'Short Description',
    example: 'Updated short description',
  })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiProperty({
    type: String,
    description: 'Description',
    example: 'Updated detailed description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: EventTypes,
    description: 'Event Type',
    example: 'online',
  })
  @IsEnum(EventTypes, {
    message: 'Event Type must be one of: online, offline',
  })
  @IsString()
  @IsOptional()
  eventType?: string;

  @ApiProperty({
    type: Boolean,
    description: 'isRestricted - true for private, false for public',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isRestricted?: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'autoEnroll',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  autoEnroll?: boolean;

  @ApiProperty({
    type: String,
    description: 'Start Datetime',
    example: '2024-03-18T10:00:00Z',
  })
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  @IsOptional()
  startDatetime?: string;

  @ApiProperty({
    type: String,
    description: 'End Datetime',
    example: '2024-03-18T12:00:00Z',
  })
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  @IsOptional()
  endDatetime?: string;

  @ApiProperty({
    type: String,
    description: 'Location',
    example: 'Updated Event Location',
  })
  @ValidateIf((o) => o.eventType === EventTypes.offline)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  location?: string;

  @ApiProperty({
    type: Number,
    description: 'Longitude',
    example: 18.508345134886994,
  })
  @ValidateIf((o) => o.eventType === EventTypes.offline)
  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @ApiProperty({
    type: Number,
    description: 'Latitude',
    example: 18.508345134886994,
  })
  @ValidateIf((o) => o.eventType === EventTypes.offline)
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @ApiProperty({
    type: String,
    description: 'Online Provider',
    example: 'Zoom',
  })
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @IsString()
  @IsNotEmpty()
  @IsIn(['Zoom', 'GoogleMeet'])
  @IsOptional()
  onlineProvider?: string;

  @ApiProperty({
    enum: MeetingType,
    description: 'Meeting Type (meeting or webinar)',
    example: 'meeting',
  })
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @IsEnum(MeetingType)
  @IsOptional()
  meetingType?: MeetingType;

  @ApiProperty({
    enum: ApprovalType,
    description: 'Approval Type for registrants',
    example: ApprovalType.AUTOMATIC,
  })
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @IsEnum(ApprovalType)
  @IsOptional()
  approvalType?: ApprovalType;

  @ApiProperty({
    type: String,
    description: 'Timezone for the meeting',
    example: 'Asia/Kolkata',
  })
  @ValidateIf((o) => o.onlineProvider !== undefined)
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether to integrate with the meeting platform',
    example: true,
  })
  @ValidateIf((o) => o.onlineProvider !== undefined)
  @IsBoolean()
  @IsOptional()
  platformIntegration?: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'isMeetingNew',
    example: false,
  })
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @IsBoolean()
  @IsOptional()
  isMeetingNew?: boolean;

  @ApiProperty({
    type: MeetingDetailsDto,
    description: 'Online Meeting Details',
    example: {
      url: 'https://example.com/meeting',
      id: 'meeting-id',
    },
  })
  @IsObject()
  @ValidateIf((o) => o.isMeetingNew === false)
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @ValidateNested({ each: true })
  @Type(() => MeetingDetailsDto)
  @Transform(({ value, obj }) => {
    if (value && obj.onlineProvider) {
      value.onlineProvider = obj.onlineProvider;
    }
    return value;
  })
  @IsOptional()
  meetingDetails?: MeetingDetailsDto;

  @ApiProperty({
    type: Number,
    description: 'Max Attendees',
    example: 100,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  maxAttendees?: number;

  @ApiProperty({
    type: Array,
    description: 'Attendees',
    example: [
      'eff008a8-2573-466d-b877-fddf6a4fc13e',
      'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9',
    ],
  })
  @ValidateIf((o) => o.isRestricted === true && o.autoEnroll)
  @IsArray()
  @Type(() => String)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  @IsOptional()
  attendees?: string[];

  @ApiProperty({
    type: Object,
    description: 'Recordings',
    example: { url: 'https://example.com/recording' },
  })
  @IsObject()
  @IsOptional()
  recordings?: any;

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
  status?: string;

  @ApiProperty({
    type: Number,
    description: 'Ideal Time in minutes',
    example: 120,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  idealTime?: number;

  @ApiProperty({
    type: String,
    description: 'Registration Start Date',
    example: '2024-03-18T10:00:00Z',
  })
  @ValidateIf((o) => o.isRestricted === false)
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  @IsOptional()
  registrationStartDate?: string;

  @ApiProperty({
    type: String,
    description: 'Registration End Date',
    example: '2024-03-18T10:00:00Z',
  })
  @ValidateIf((o) => o.isRestricted === false)
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  @IsOptional()
  registrationEndDate?: string;

  @ApiProperty({
    type: Boolean,
    description: 'isRecurring',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'isMainEvent - true to update all recurring events, false to update specific event',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isMainEvent?: boolean;

  @ApiProperty({
    type: RecurrencePatternDto,
    description: 'recurrencePattern',
    example: { frequency: 'daily', interval: 1 },
  })
  @IsObject()
  @ValidateIf((o) => o.isRecurring === true)
  @ValidateNested({ each: true })
  @Type(() => RecurrencePatternDto)
  @IsOptional()
  recurrencePattern?: RecurrencePatternDto;

  @ApiProperty({
    type: Object,
    description: 'Event meta data',
    example: { category: 'Education' },
  })
  @IsObject()
  @IsOptional()
  metaData?: any;

  @ApiProperty({
    type: Object,
    description: 'Meta data for recurring events',
    example: { topic: 'Java Programming' },
  })
  @IsObject()
  @IsOptional()
  erMetaData?: any;

  updatedBy: string;

  @IsOptional()
  updateAt?: Date;

  // Validation to ensure at least one field is provided for update
  @ValidateIf(
    (o) =>
      !o.title &&
      !o.shortDescription &&
      !o.description &&
      !o.eventType &&
      !o.isRestricted &&
      !o.autoEnroll &&
      !o.startDatetime &&
      !o.endDatetime &&
      !o.location &&
      !o.longitude &&
      !o.latitude &&
      !o.onlineProvider &&
      !o.meetingType &&
      !o.approvalType &&
      !o.timezone &&
      !o.platformIntegration &&
      !o.isMeetingNew &&
      !o.meetingDetails &&
      !o.maxAttendees &&
      !o.attendees &&
      !o.recordings &&
      !o.status &&
      !o.idealTime &&
      !o.registrationStartDate &&
      !o.registrationEndDate &&
      !o.isRecurring &&
      !o.recurrencePattern &&
      !o.metaData &&
      !o.erMetaData,
  )
  @IsNotEmpty({
    message: 'At least one field must be provided for update.',
  })
  validateFields?: any;
}