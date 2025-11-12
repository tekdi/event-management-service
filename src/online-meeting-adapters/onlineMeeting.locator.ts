import {
  AttendanceRecord,
  UserDetails,
  MeetingType,
  ApprovalType,
} from 'src/common/utils/types';
import { ParticipantListResponseDto } from './zoom/dto/participant-list-response.dto';

export interface CreateMeetingRequest {
  topic: string;
  startTime: string;
  duration: number;
  password?: string;
  timezone?: string;
  approvalType?: ApprovalType;
  settings?: {
    hostVideo?: boolean;
    participantVideo?: boolean;
    joinBeforeHost?: boolean;
    muteUponEntry?: boolean;
    watermark?: boolean;
    usePmi?: boolean;
    approvalType?: ApprovalType;
    audio?: string;
    autoRecording?: string;
    registrantsConfirmationEmail?: boolean;
    registrantsEmailNotification?: boolean;
    waitingRoom?: boolean;
    jbhTime?: number;
  };
}

export interface IOnlineMeetingLocator {
  // Authentication
  getToken: () => Promise<string>;

  // Meeting Management
  createMeeting: (
    request: CreateMeetingRequest,
    meetingType: MeetingType,
  ) => Promise<any>;
  updateMeeting: (
    meetingId: string,
    request: Partial<CreateMeetingRequest>,
    meetingType: MeetingType,
  ) => Promise<any>;
  deleteMeeting: (meetingId: string, meetingType: MeetingType) => Promise<void>;
  getMeetingDetails: (
    meetingId: string,
    meetingType: MeetingType,
  ) => Promise<any>;
  listMeetings: (meetingType: MeetingType, query?: any) => Promise<any>;


  getMeetingParticipantList: (
    token: string,
    userArray: any[],
    meetingId: string,
    meetingType: MeetingType,
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
    meetingType: MeetingType,
    pageSize: number,
  ) => Promise<ParticipantListResponseDto>;

  // Registrant Management
  addRegistrantToMeeting: (
    meetingId: string,
    registrantData: {
      email: string;
      first_name: string;
      last_name: string;
    },
    meetingType?: MeetingType,
  ) => Promise<any>;
  removeRegistrantFromMeeting: (
    meetingId: string,
    registrantId: string,
    meetingType?: MeetingType,
  ) => Promise<any>;
  getRegistrants: (
    meetingId: string,
    meetingType?: MeetingType,
    pageSize?: number,
    nextPageToken?: string,
  ) => Promise<any>;
  checkRegistrantByEmail: (
    meetingId: string,
    email: string,
    meetingType?: MeetingType,
  ) => Promise<any | null>;
}
