import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsEnum, IsString, IsUUID, Max, Min, IsJSON, IsLatitude, IsLongitude, IsDateString, IsObject, ValidateIf, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MeetingDetailsDto {
  @ApiProperty({ description: 'Meeting ID', example: 94292617 })
  @IsInt()
  @IsNotEmpty()
  id: number;

  @ApiProperty({ description: 'Meeting topic', example: 'Test_Meeting' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({ description: 'Meeting password', example: "xxxxxx" })
  @IsString()
  @IsNotEmpty()
  password: string;
}


export class CreateEventDto {
  // @IsUUID()
  eventId: string;

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
    example: 'This is a sample event'
  })
  @IsString()
  @IsNotEmpty()
  shortDescription: string;


  @ApiProperty({
    type: String,
    description: 'Description',
    example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
  })
  @IsString()
  @IsNotEmpty()
  description: string;


  @ApiProperty({
    type: String,
    description: 'image',
    example: 'https://example.com/sample-image.jpg'
  })
  @IsString()
  @IsNotEmpty()
  image: string;


  @ApiProperty({
    type: String,
    description: 'Event Type',
    example: 'online'
  })
  @IsEnum(['online', 'offline'], {
    message: 'Event Type must be one of: online, offline'
  }
  )
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({
    type: String,
    description: 'isRestricted',
    example: true
  })
  @IsBoolean()
  isRestricted: boolean;

  @ApiProperty({
    type: String,
    description: 'Start Datetime',
    example: '2024-03-18T10:00:00Z'
  })
  @IsDateString()
  startDatetime: Date;

  @ApiProperty({
    type: String,
    description: 'End Datetime',
    example: '2024-03-18T10:00:00Z'
  })
  @IsDateString()
  endDatetime: Date;

  @ApiProperty({
    type: String,
    description: 'Location',
    example: 'Event Location'
  })
  @ValidateIf(o => o.eventType === 'offline')
  @IsString()
  @IsNotEmpty()
  location: string;


  @ApiProperty({
    type: Number,
    description: 'Longitude',
    example: 18.508345134886994
  })
  @ValidateIf(o => o.eventType === 'offline')
  @IsLongitude()
  longitude: number;

  @ValidateIf(o => o.eventType === 'offline')
  @ApiProperty({
    type: Number,
    description: 'Latitude',
    example: 18.508345134886994
  })
  @IsLatitude()
  latitude: number;

  @ApiProperty({
    type: String,
    description: 'Online Provider',
    example: 'zoom'
  })
  @ValidateIf(o => o.eventType === 'online')
  @IsString()
  @IsNotEmpty()
  onlineProvider: string;

  // @ApiProperty({
  //   type: String,
  //   description: 'Registration Deadline',
  //   example: '2024-03-18T10:00:00Z'
  // })
  // @IsDateString()
  // registrationDeadline: Date;


  @ApiProperty({
    type: String,
    description: 'Registration Deadline',
    example: '2024-03-18T10:00:00Z'
  })
  @IsDateString()
  registrationStartDate: Date;


  @ApiProperty({
    type: String,
    description: 'Registration Deadline',
    example: '2024-03-18T10:00:00Z'
  })
  @IsDateString()
  registrationEndDate: Date;




  @ApiProperty({
    type: Number,
    description: 'Max Attendees',
    example: 100
  })
  @IsInt()
  @Min(0)
  maxAttendees: number;

  @ApiProperty({
    type: Object,
    description: 'Params',
    // example: { cohortIds: ['eff008a8-2573-466d-b877-fddf6a4fc13e', 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9'] },
    // example: { userIds: ['eff008a8-2573-466d-b877-fddf6a4fc13e', 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9'] },
    example: { cohortIds: ['eff008a8-2573-466d-b877-fddf6a4fc13e'] },
  })
  @IsObject()
  params: any;

  @ApiProperty({
    type: Object,
    description: 'Recordings',
    example: { url: 'https://example.com/recording' }
  })
  @IsObject()
  recordings: any;

  @ApiProperty({
    type: String,
    description: 'Status',
    example: 'live'
  })
  @IsEnum(['live', 'draft', 'inActive'], {
    message: 'Status must be one of: live, draft, inActive',
  })
  @IsString()
  @IsNotEmpty()
  status: string;


  @ApiProperty({
    type: Boolean,
    description: 'isMeetingNew',
    example: false
  })
  @ValidateIf(o => o.eventType === 'online')
  @IsNotEmpty()
  isMeetingNew: boolean;

  @ApiProperty({ type: MeetingDetailsDto, description: 'Filters for search' })
  @IsObject()
  @ValidateIf(o => o.isMeetingNew === false)
  @ValidateIf(o => o.eventType === 'online')
  @ValidateNested({ each: true })
  @Type(() => MeetingDetailsDto)
  meetingDetails: any;

  createdBy: string;

  updatedBy: string;

  autoEnroll: boolean;
}




