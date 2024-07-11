import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateMeetingDto } from './dto/create-Meeting.dto';
import { MeetingAdapterFactory } from './meetingadapter';
import { Response } from 'express';
import APIResponse from 'src/common/utils/response';
import { ConfigService } from '@nestjs/config';
import { ZoomMeetingAdapter } from './adapter/zoom.adapter';
import { APIID } from 'src/common/utils/api-id.config';

@Injectable()
export class MeetingsService {
    constructor(private readonly adapterFactory: MeetingAdapterFactory,
        private readonly configService: ConfigService,
        private readonly zoomMeetingAdapter: ZoomMeetingAdapter) {
    }

    async createMeeting(createMeetingDto: CreateMeetingDto) {
        try {
            const meetingAdapter = this.adapterFactory.getAdapter(createMeetingDto.meetingType)
            const result = await meetingAdapter.createMeeting(createMeetingDto)
            return result;
        }
        catch (e) {
            throw new Error(e.message);
        }
    }

    async getMeetingList(meetingName, response: Response) {
        const apiId = APIID.MEETING_LIST;
        try {
            const meetingType = this.adapterFactory.getAdapter(meetingName);
            const result = await meetingType.getMeetingList();
            return APIResponse.success(response, apiId, result, HttpStatus.OK, 'Meeting list fetched succesfully')
        }
        catch (e) {
            const errorMessage = e.message || 'Internal server error';
            return APIResponse.error(response, apiId, "Internal Server Error", errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getOnlineProviders(response: Response) {
        const apiId = APIID.ONLINE_PROVIDER;
        try {
            const onlineProviders = [];
            const zoomProvider = this.zoomMeetingAdapter.checkZoomConfig();
            if (zoomProvider) {
                onlineProviders.push(zoomProvider);
            }
            // if (googleMeetProvider) {
            //     onlineProviders.push(googleMeetProvider);
            // }
            if (onlineProviders.length === 0) {
                return APIResponse.error(response, apiId, 'Not Found', 'providers not found', HttpStatus.NOT_FOUND)
            }
            return APIResponse.success(response, apiId, onlineProviders, HttpStatus.OK, 'online providers list fetched succesfully')
        }
        catch (e) {
            return APIResponse.error(response, apiId, 'Not Found', 'provide not found', HttpStatus.NOT_FOUND)
        }
    }

    async updateMeeting(meetingId, updateeMeetingDto) {
        const apiId = APIID.MEETING_UPDATE;
        try {
            const meetingType = this.adapterFactory.getAdapter(updateeMeetingDto.meetingType);
            const result = await meetingType.updateMeeting(meetingId, updateeMeetingDto);
            if (result.status === 204) {
                return result;
            }
        }
        catch (e) {
            return e;
        }
    }
}
