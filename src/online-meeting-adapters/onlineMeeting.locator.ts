import { AttendanceRecord, UserDetails } from 'src/common/utils/types';

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
    meetingParticipantDetails: any[],
    markAttendanceBy: string,
  ) => AttendanceRecord[];
  getMeetingParticipantsIdentifiers: (
    meetingId: string,
    markAttendanceBy: string,
  ) => Promise<{ identifiers: string[]; inMeetingUserDetails: any[] }>;
}
