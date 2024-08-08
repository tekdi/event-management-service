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
        occurenceId: string;
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
  occurenceId: string;
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
  endCondition: {
    type: EndConditionType;
    value: string;
  };
};
