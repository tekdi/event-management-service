import { BadRequestException, Injectable } from "@nestjs/common";
import { ZoomMeetingAdapter } from "./adapter/zoom.adapter";
import { MeetingServiceInterface } from "./interface/meeting-service.interface";

@Injectable()
export class MeetingAdapterFactory {
    constructor(
        private readonly zoomMeetingAdapter: ZoomMeetingAdapter
    ) { }

    getAdapter(meetingType: string): MeetingServiceInterface {
        switch (meetingType) {
            case 'zoom':
                return this.zoomMeetingAdapter;
            // case 'googleMeet':
            //     return this.googleMeetingAdapter;
            default:
                throw new BadRequestException('Invalid Meeting type.');
        }
    }
}
