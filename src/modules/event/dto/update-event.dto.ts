import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum, IsLongitude, IsLatitude, IsBoolean, IsInt, Min, IsDateString, IsObject, ValidateIf, ValidateNested } from 'class-validator';
import { MeetingDetailsDto } from "./create-event.dto";
import { Type } from "class-transformer";
import { Optional } from "@nestjs/common";
export class UpdateEventDto {

    @ApiProperty({
        type: String,
        description: 'title',
        example: 'Sample Event'
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    title?: string;

    @ApiProperty({
        type: String,
        description: 'Short Description',
        example: 'This is a sample event',
        required: false,
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    shortDescription?: string;

    @ApiProperty({
        type: String,
        description: 'Description',
        example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    description: string;


    @ApiProperty({
        type: String,
        description: 'image',
        example: 'https://example.com/sample-image.jpg'
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
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
    @IsOptional()
    eventType: string;

    @ApiProperty({
        type: String,
        description: 'isRestricted',
        example: true
    })
    @IsBoolean()
    @IsOptional()
    isRestricted: boolean;

    @ApiProperty({
        type: String,
        description: 'Start Datetime',
        example: '2024-03-18T10:00:00Z'
    })
    @IsDateString()
    @IsOptional()
    startDatetime: Date;

    @ApiProperty({
        type: String,
        description: 'End Datetime',
        example: '2024-03-18T10:00:00Z'
    })
    @IsDateString()
    @IsOptional()
    endDatetime: Date;

    @ApiProperty({
        type: String,
        description: 'Location',
        example: 'Event Location'
    })
    @IsString()
    @IsNotEmpty()
    @ValidateIf(o => o.eventType === 'offline')
    // @IsOptional()
    location: string;


    @ApiProperty({
        type: Number,
        description: 'Latitude',
        example: 18.508345134886994
    })
    @IsLongitude()
    @IsNotEmpty()
    // @IsOptional()
    @ValidateIf(o => o.eventType === 'offline')
    longitude: number;

    @ApiProperty({
        type: Number,
        description: 'Latitude',
        example: 18.508345134886994
    })
    @IsLatitude()
    @IsNotEmpty()
    @ValidateIf(o => o.eventType === 'offline')
    // @IsOptional()
    latitude: number;

    @ApiProperty({
        type: String,
        description: 'Online Provider',
        example: 'zoom'
    })
    @IsString()
    @IsNotEmpty()
    // @IsOptional()
    @ValidateIf(o => o.eventType === 'online')
    onlineProvider: string;

    // @ApiProperty({
    //     type: String,
    //     description: 'Registration Deadline',
    //     example: '2024-03-18T10:00:00Z'
    // })
    // @IsDateString()
    // @IsOptional()
    // registrationDeadline: Date;

    @ApiProperty({
        type: String,
        description: 'Registration Deadline',
        example: '2024-03-18T10:00:00Z'
    })
    @IsDateString()
    @IsOptional()
    registrationStartDate: Date;


    @ApiProperty({
        type: String,
        description: 'Registration Deadline',
        example: '2024-03-18T10:00:00Z'
    })
    @IsOptional()
    @IsDateString()
    registrationEndDate: Date;



    @ApiProperty({
        type: Number,
        description: 'Max Attendees',
        example: 100
    })
    @IsInt()
    @IsOptional()
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
    @IsOptional()
    params: any;

    @ApiProperty({
        type: Object,
        description: 'Recordings',
        example: { url: 'https://example.com/recording' }
    })
    @IsObject()
    @IsOptional()
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
    @IsOptional()
    @IsNotEmpty()
    status: string;

    @ApiProperty({
        type: Boolean,
        description: 'isMeetingNew',
        example: false
    })
    @IsNotEmpty()
    @ValidateIf(o => o.eventType === 'online')
    isMeetingNew: boolean;

    @ApiProperty({ type: MeetingDetailsDto, description: 'Filters for search' })
    @IsObject()
    @ValidateIf(o => o.isMeetingNew === false)
    @ValidateIf(o => o.eventType === 'online')
    @ValidateNested({ each: true })
    @Type(() => MeetingDetailsDto)
    meetingDetails: any;


    @IsString()
    @IsOptional()
    createdBy: string;

    @IsString()
    @IsOptional()
    updatedBy: string;

    @IsOptional()
    updateAt: Date;

}

