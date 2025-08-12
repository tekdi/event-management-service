export enum EventTypes {
  online = 'online',
  offline = 'offline',
}

export enum EventStatus {
  live = 'live',
  draft = 'draft',
  inactive = 'inactive',
  archived = 'archived',
}

export enum AttendeesStatus {
  active = 'active',
  inactive = 'inactive',
  archived = 'archived',
}

export enum Frequency {
  daily = 'daily',
  weekly = 'weekly',
  // monthly = 'monthly',
  // yearly = 'yearly',
}

export type RepetitionDetail = {
  onlineDetails:
    | {
        id: string;
        url: string;
        password: string;
        occurrenceId: string;
        providerGenerated: boolean;
      }
    | {}
    | null;
  erMetaData: any;
  eventRepetitionId: string;
  startDateTime: Date;
  endDateTime: Date;
};

export type MeetingDetails = {
  id: string;
  url: string;
  password: string;
  providerGenerated: boolean;
  occurrenceId: string;
  attendanceMarked: boolean;
};

export enum DaysOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

export enum EndConditionType {
  endDate = 'endDate',
  occurrences = 'occurrences',
}

export type RecurrencePattern = {
  frequency: Frequency;
  interval: number;
  daysOfWeek?: DaysOfWeek[]; //weekly
  dayOfMonth?: number; // 1-31 validation
  // byDay: string;
  // byMonth: string;
  // byMonthDay: string;
  recurringStartDate: string;
  endCondition: {
    type: EndConditionType;
    value: string;
  };
};

export type ZoomParticipant = {
  id: string;
  user_id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
  registrant_id: string;
  failover: boolean;
  status: string;
  groupId: string;
  internal_user: boolean;
};

export type UserDetails = {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: string;
  mobile: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  total_count: string;
};

export interface AttendanceRecord {
  userId: string;
  attendance: 'present' | 'absent';
  metaData: {
    autoMarked: boolean;
    duration: number;
    joinTime: string;
    leaveTime: string;
    attendancePercentage?: number;
    totalMeetingDuration?: number;
  };
}

export interface InZoomMeetingUserDetails {
  user_email: string;
  duration: number;
  join_time: string;
  leave_time: string;
}
