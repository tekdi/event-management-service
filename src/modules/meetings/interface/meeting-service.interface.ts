import { CreateMeetingDto } from "../dto/create-Meeting.dto";
import { UpdateeMeetingDto } from "../dto/update-Meeting.dto";

export interface MeetingServiceInterface {
    createMeeting(createMeetingDto: CreateMeetingDto)
    getMeetingList();
    updateMeeting(meetingId, updateeMeetingDto: UpdateeMeetingDto);
    getToken();
}