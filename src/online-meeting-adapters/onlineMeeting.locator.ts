import {
  AttendanceRecord,
  InZoomMeetingUserDetails,
  UserDetails,
} from 'src/common/utils/types';

export interface IOnlineMeetingLocator {
  getToken: () => Promise<string>;
  getMeetingParticipantList: (
    token: string,
    userArray: any[],
    meetingId: string,
    url: string,
  ) => Promise<any>;
  getParticipantAttendance: (
    userList: UserDetails[],
    meetingParticipantDetails: InZoomMeetingUserDetails[],
  ) => AttendanceRecord[];
  getMeetingParticipantsEmail: (meetingId: string) => Promise<any>;
}
