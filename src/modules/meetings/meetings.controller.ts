import { Body, Controller, Get, Param, Patch, Post, Res, UseFilters } from '@nestjs/common';
import { CreateMeetingDto } from './dto/create-Meeting.dto';
import { ApiBody } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { AllExceptionsFilter } from 'src/common/filters/exception.filter';
import { APIID } from 'src/common/utils/api-id.config';
import { Response } from 'express';
import { UpdateeMeetingDto } from './dto/update-Meeting.dto';


@Controller('meetings/v1')
export class MeetingsController {
    constructor(
        private readonly meetingsService: MeetingsService
    ) { }

    @Post('/create')
    @ApiBody({
        type: CreateMeetingDto
    })
    async createMeetings(@Body() createMeetingDto: CreateMeetingDto) {
        return await this.meetingsService.createMeeting(createMeetingDto);
    }


    @UseFilters(new AllExceptionsFilter(APIID.ONLINE_PROVIDER))
    @Get('onlineProvider')
    async getOnlineProvider(@Res() response: Response) {
        return await this.meetingsService.getOnlineProviders(response)
    }

    @UseFilters(new AllExceptionsFilter(APIID.MEETING_LIST))
    @Get('/:meetingName')
    async getMeetingList(@Param('meetingName') meetingName: string, @Res() response: Response) {
        return await this.meetingsService.getMeetingList(meetingName, response);
    }

    @UseFilters(new AllExceptionsFilter(APIID.MEETING_UPDATE))
    @Patch('/:meetingId')
    @ApiBody({
        type: UpdateeMeetingDto
    })
    async updateMeeting(@Param('meetingId') meetingId: string, @Body() updateeMeetingDto: UpdateeMeetingDto) {
        return await this.meetingsService.updateMeeting(meetingId, updateeMeetingDto);
    }

}
