import { AttendanceRecord, UserDetails } from '../common/utils/types';

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
  ) => AttendanceRecord[];
  getMeetingParticipantsEmail: (meetingId: string) => Promise<any>;
}
