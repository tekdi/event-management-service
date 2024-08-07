import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum, IsLongitude, IsLatitude, IsBoolean, IsInt, Min, IsDateString, IsObject, ValidateIf, ValidateNested, Validate } from 'class-validator';
import { MeetingDetails } from "src/common/utils/types";
import { Type } from "class-transformer";
import { UrlWithProviderValidator } from "src/common/utils/validation.util";
export interface UpdateResult {
    onlineDetails?: any; // Replace 'any' with the appropriate type if known
    erMetaData?: any;    // Replace 'any' with the appropriate type if known
    eventDetails?: any;  // Replace 'any' with the appropriate type if known
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
        example: 'live'
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
        example: 'Sample Event'
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    title?: string;

    @ApiProperty({
        type: String,
        description: 'isRecurring',
        example: true
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


    @IsObject()
    @IsOptional()
    erMetaData: any;


    // Validation to ensure if isMainEvent is true, title or status must be provided
    @ValidateIf(o => !o.title && !o.status && !o.onlineDetails && !o.location && !o.latitude && !o.erMetaData && !o.startTime) // Ensure that if neither title nor status is provided, validation fails
    @IsNotEmpty({ message: 'If isMainEvent is provided, at least one of title or status must be provided.' })
    dummyField?: any;


    // @ApiProperty({
    //     type: String,
    //     description: 'Event Type',
    //     example: 'online'
    // })
    // @IsEnum(['online', 'offline', 'onlineandoffline'], {
    //     message: 'Event Type must be one of: online, offline, onlineandoffline'
    // }
    // )
    // @IsString()
    // @IsNotEmpty()
    // @IsOptional()
    // eventType: string;



    // @ApiProperty({
    //     type: String,
    //     description: 'Start Datetime',
    //     example: '2024-03-18T10:00:00Z'
    // })
    // @IsDateString()
    // @IsOptional()
    // startDatetime: Date;

    // @ApiProperty({
    //     type: String,
    //     description: 'End Datetime',
    //     example: '2024-03-18T10:00:00Z'
    // })
    // @IsDateString()
    // @IsOptional()
    // endDatetime: Date;

    @ApiProperty({
        type: String,
        description: 'Location',
        example: 'Event Location'
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    location: string;


    @ApiProperty({
        type: Number,
        description: 'Latitude',
        example: 18.508345134886994
    })
    @ValidateIf(o => o.latitude !== undefined)
    @IsLongitude()
    longitude: number;

    @ApiProperty({
        type: Number,
        description: 'Latitude',
        example: 18.508345134886994
    })
    @ValidateIf(o => o.longitude !== undefined)
    @IsLatitude()
    latitude: number;


    // @ApiProperty({
    //     type: String,
    //     description: 'Short Description',
    //     example: 'This is a sample event',
    //     required: false,
    // })
    // @IsString()
    // @IsNotEmpty()
    // @IsOptional()
    // shortDescription?: string;

    // @ApiProperty({
    //     type: String,
    //     description: 'Description',
    //     example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    // })
    // @IsString()
    // @IsNotEmpty()
    // @IsOptional()
    // description: string;

    // @ApiProperty({
    //     type: String,
    //     description: 'Online Provider',
    //     example: 'Zoom'
    // })
    // @IsString()
    // @IsNotEmpty()
    // @IsOptional()
    // onlineProvider: string;

    // @ApiProperty({
    //     type: String,
    //     description: 'Registration Deadline',
    //     example: '2024-03-18T10:00:00Z'
    // })
    // @IsDateString()
    // @IsOptional()
    // registrationDeadline: Date;

    // @ApiProperty({
    //     type: Number,
    //     description: 'Max Attendees',
    //     example: 100
    // })
    // @IsInt()
    // @IsOptional()
    // @Min(0)
    // maxAttendees: number;

    // @ApiProperty({
    //     type: Object,
    //     description: 'Params',
    //     // example: { cohortIds: ['eff008a8-2573-466d-b877-fddf6a4fc13e', 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9'] },
    //     // example: { userIds: ['eff008a8-2573-466d-b877-fddf6a4fc13e', 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9'] },
    //     example: { cohortIds: ['eff008a8-2573-466d-b877-fddf6a4fc13e'] },
    // })
    // @IsObject()
    // @IsOptional()
    // params: any;

    // @ApiProperty({
    //     type: Object,
    //     description: 'Recordings',
    //     example: { url: 'https://example.com/recording' }
    // })
    // @IsObject()
    // @IsOptional()
    // recordings: any;

    // @ApiProperty({
    //     type: String,
    //     description: 'isRestricted',
    //     example: true
    // })
    // @IsBoolean()
    // @IsOptional()
    // isRestricted: boolean;


    @IsString()
    @IsOptional()
    createdBy: string;

    @IsString()
    @IsOptional()
    updatedBy: string;

    @IsOptional()
    updateAt: Date;

}

