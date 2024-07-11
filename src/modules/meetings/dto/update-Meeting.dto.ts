import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsEnum, IsString, IsUUID, Max, Min, IsJSON, IsLatitude, IsLongitude, IsDateString, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class UpdateeMeetingDto {

    @ApiProperty({
        type: String,
        description: 'meetingType',
        example: 'zoom',
    })
    @IsString()
    meetingType: string;

    @ApiProperty({
        type: String,
        description: 'topic',
        example: 'Test Meeting',
    })
    @IsString()
    @IsOptional()
    topic: string;

    @IsNumber()
    @IsNotEmpty()
    type: number;


    @ApiProperty({
        type: Date,
        description: 'Start Datetime',
        example: '2024-03-18T10:00:00Z'
    })
    @IsOptional()
    start_time: Date;

    duration: number;

    timezone: string;
}
