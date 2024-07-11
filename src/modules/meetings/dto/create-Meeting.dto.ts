import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateMeetingDto {

    @ApiProperty({
        type: String,
        description: 'meetingType',
        example: 'zoom',
    })
    @IsString()
    // @IsNotEmpty()
    meetingType: string;

    @ApiProperty({
        type: String,
        description: 'topic',
        example: 'Test Meeting',
    })
    @IsString()
    @IsNotEmpty()
    topic: string;

    @IsNumber()
    @IsNotEmpty()
    type: number;


    @ApiProperty({
        type: Date,
        description: 'Start Datetime',
        example: '2024-03-18T10:00:00Z'
    })
    start_time: Date;

    duration: number;

    timezone: string;
}
