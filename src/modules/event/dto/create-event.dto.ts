import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsUUID,
  Min,
  IsLatitude,
  IsLongitude,
  IsDateString,
  IsObject,
  ValidateIf,
  ValidateNested,
  IsArray,
  IsDefined,
  ArrayMinSize,
  ArrayMaxSize,
  Validate,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  EndConditionType,
  EventTypes,
  Frequency,
  OnlineDetails,
  MeetingType,
  ApprovalType,
} from 'src/common/utils/types';
import { ERROR_MESSAGES } from 'src/common/utils/constants.util';
import { EndsWithZConstraint } from 'src/common/pipes/event-validation.pipe';
import { UrlWithProviderValidator } from 'src/common/utils/validation.util';

export class MeetingDetailsDto {
  // Pass the provider from the parent DTO
  onlineProvider: string;

  @ApiProperty({ description: 'Meeting ID', example: 94292617 })
  @IsString()
  // @IsNotEmpty()
  @IsOptional()
  id: string;

  @ApiProperty({
    description: 'Meeting url',
    example: 'https://example.com/meeting',
  })
  @IsString()
  @IsNotEmpty()
  @Validate(UrlWithProviderValidator)
  url: string;

  @ApiProperty({
    description: 'Meeting password',
    writeOnly: true, // This will hide it from API response docs
  })
  @IsString()
  @IsOptional()
  password: string;

  @ApiProperty({
    type: String,
    description: 'providerGenerated',
    default: false,
  })
  providerGenerated: boolean;

  attendanceMarked: boolean;

  @ApiProperty({
    enum: MeetingType,
    description: 'Meeting Type (meeting or webinar)',
    example: 'meeting',
    default: 'meeting',
  })
  @IsEnum(MeetingType)
  @IsOptional()
  meetingType?: MeetingType;

  @ApiProperty({
    enum: ApprovalType,
    description: 'Approval Type for registrants',
    example: ApprovalType.AUTOMATIC,
    default: ApprovalType.AUTOMATIC,
  })
  @IsEnum(ApprovalType)
  @IsOptional()
  approvalType?: ApprovalType;
}

export class EndCondition {
  @ApiProperty({
    type: String,
    description: 'Type of end condition',
    example: 'endDate',
  })
  @IsString()
  @IsNotEmpty()
  type: EndConditionType;

  @ApiProperty({
    type: String,
    description: 'Value of end condition',
    example: '2024-03-18T10:00:00Z | 5',
  })
  @ValidateIf((o) => o.type === 'endDate')
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  @IsNotEmpty()
  value: string;
}

export class RecurrencePatternDto {
  @ApiProperty({
    enum: Frequency,
    description: 'Frequency',
    example: 'daily',
  })
  @IsEnum(Frequency, {
    message: 'Frequency must be one of: daily, weekly',
  })
  @IsNotEmpty()
  frequency: string;

  @ApiProperty({
    type: Number,
    description: 'Interval',
    example: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  interval: number = 1; // default 1 if not provided

  @ApiProperty({
    type: [String],
    description: 'Days of Week',
    example: [1, 3, 5],
  })
  @ValidateIf((o) => o.frequency === 'weekly')
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  daysOfWeek: number[];

  // @ApiProperty({
  //   type: Number,
  //   description: 'Day of Month',
  //   example: 1,
  // })
  // @IsInt()
  // @IsOptional()
  // dayOfMonth: number;

  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  // @IsOptional()
  recurringStartDate: string;

  @ApiProperty({
    type: EndCondition,
    description: 'End Condition',
    example: {
      type: 'endDate',
      value: '2024-03-18T10:00:00Z',
    },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => EndCondition)
  endCondition: EndCondition;
}

/**
 * All Datetime properties
 * should be in ISO 8601 format (e.g., '2024-03-18T10:00:00Z').
 */

export class CreateEventDto {
  // @IsUUID()
  // eventID: string;

  @ApiProperty({
    type: String,
    description: 'title',
    example: 'Sample Event',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    type: String,
    description: 'Short Description',
    example: 'This is a sample event',
  })
  @IsString()
  shortDescription: string;

  @ApiProperty({
    type: String,
    description: 'Description',
    example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  })
  @IsString()
  description: string;

  @ApiProperty({
    enum: EventTypes,
    description: 'Event Type',
    example: 'online',
  })
  @IsEnum(EventTypes, {
    message: 'Event Type must be one of: online, offline',
  })
  @IsString()
  @IsNotEmpty()
  eventType: string; // offline

  @ApiProperty({
    type: String,
    description: 'isRestricted', // true for private, false for public
    example: true,
  })
  @IsBoolean()
  isRestricted: boolean;

  @ApiProperty({
    type: String,
    description: 'autoEnroll',
    example: true,
  })
  autoEnroll: boolean;

  @ApiProperty({
    type: String,
    description: 'Start Datetime',
    example: '2024-03-18T10:00:00',
  })
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  startDatetime: string;

  @ApiProperty({
    type: String,
    description: 'End Datetime',
    example: '2024-03-18T10:00:00',
  })
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  endDatetime: string;

  @ApiProperty({
    type: String,
    description: 'Location',
    example: 'Event Location',
  })
  @ValidateIf((o) => o.eventType === EventTypes.offline)
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    type: Number,
    description: 'Latitude',
    example: 18.508345134886994,
  })
  @ValidateIf((o) => o.eventType === EventTypes.offline)
  @IsLongitude()
  @IsOptional()
  longitude: number;

  @ApiProperty({
    type: Number,
    description: 'Latitude',
    example: 18.508345134886994,
  })
  @ValidateIf((o) => o.eventType === EventTypes.offline)
  @IsLatitude()
  @IsOptional()
  latitude: number;

  @ApiProperty({
    type: String,
    description: 'Online Provider',
    example: 'Zoom',
  })
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @IsString()
  @IsNotEmpty()
  @IsIn(['Zoom', 'GoogleMeet']) //, 'MicrosoftTeams' // Supported providers
  onlineProvider: string;

  @ApiProperty({
    enum: MeetingType,
    description: 'Meeting Type (meeting or webinar)',
    example: 'meeting',
    default: 'meeting',
  })
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @IsEnum(MeetingType)
  @IsOptional()
  meetingType: MeetingType = MeetingType.meeting;

  @ApiProperty({
    enum: ApprovalType,
    description: 'Approval Type for registrants',
    example: ApprovalType.AUTOMATIC,
    default: ApprovalType.AUTOMATIC,
  })
  @ValidateIf((o) => o.eventType === EventTypes.online)
  @IsEnum(ApprovalType)
  @IsOptional()
  approvalType: ApprovalType;

  @ApiProperty({
    type: String,
    description:
      'Timezone for the meeting (e.g., "America/New_York", "Asia/Kolkata")',
    example: 'Asia/Kolkata',
    default: 'UTC',
  })
  @ValidateIf((o) => o.onlineProvider !== undefined)
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether to integrate with the meeting platform (Zoom) for creating/updating meetings',
    example: true,
    default: true,
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
  @IsNotEmpty()
  isMeetingNew: boolean;

  @ApiProperty({
    type: MeetingDetailsDto,
    description: 'Online Meeting Details',
    example: {
      url: 'https://example.com/meeting',
      id: 'meeting-id',
      // password: '**********', // This will be hidden from API response docs
    },
  })
  @IsObject()
  @ValidateIf((o) => o.isMeetingNew === false)
  @ValidateIf((o) => o.eventType === 'online')
  @ValidateNested({ each: true })
  @Type(() => MeetingDetailsDto)
  @Transform(({ value, obj }) => {
    value.onlineProvider = obj.onlineProvider; // Pass the provider to the nested DTO
    return value;
  })
  onlineDetails: OnlineDetails;

  @ApiProperty({
    type: Number,
    description: 'Max Attendees',
    example: 100,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  maxAttendees: number;

  @ApiProperty({
    type: Object,
    description: 'Attendees',
    example: [
      'eff008a8-2573-466d-b877-fddf6a4fc13e',
      'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9',
    ],
  })
  @ValidateIf((o) => o.isRestricted === true && o.autoEnroll)
  @IsDefined({ message: ERROR_MESSAGES.ATTENDEES_REQUIRED })
  @IsArray()
  @Type(() => String)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  attendees: string[];

  @ApiProperty({
    type: Object,
    description: 'Recordings',
    example: { url: 'https://example.com/recording' },
  })
  @IsObject()
  @IsOptional()
  recordings: any;

  @ApiProperty({
    type: String,
    description: 'Status',
    example: 'live',
  })
  @IsEnum(['live'], {
    //, 'draft', 'archived'], {
    // TODO: message: 'Status must be one of: live, draft, archived',
  })
  @IsString()
  @IsNotEmpty()
  status: string;

  createdBy: string;

  updatedBy: string;

  @ApiProperty({
    type: String,
    description: 'idealTime',
    example: 120,
  })
  @IsOptional()
  idealTime: number;

  @ApiProperty({
    type: String,
    description: 'registrationStartDate',
    example: '2024-03-18T10:00:00',
  })
  @ValidateIf((o) => o.isRestricted === false)
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  @IsOptional()
  registrationStartDate: string;

  @ApiProperty({
    type: String,
    description: 'registrationEndDate',
    example: '2024-03-18T10:00:00',
  })
  @ValidateIf((o) => o.isRestricted === false)
  @Validate(EndsWithZConstraint)
  @IsDateString({ strict: true, strictSeparator: true })
  @IsOptional()
  registrationEndDate: string;

  @ApiProperty({
    type: String,
    description: 'isRecurring',
    example: true,
  })
  @IsBoolean()
  isRecurring: boolean;

  @ApiProperty({
    type: RecurrencePatternDto,
    description: 'recurrencePattern',
    example: { frequency: 'daily', interval: 1 },
  })
  @IsObject()
  @ValidateIf((o) => o.isRecurring === true)
  @ValidateNested({ each: true })
  @Type(() => RecurrencePatternDto)
  recurrencePattern: RecurrencePatternDto;

  @ApiProperty({
    type: Object,
    description: 'Event meta data',
    example: '',
  })
  @IsObject()
  @IsOptional()
  metaData: any;

  @ApiProperty({
    type: Object,
    description: 'Meta data for recurring events',
    example: '',
  })
  @IsObject()
  @IsOptional()
  erMetaData: any;
}
