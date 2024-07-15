export enum EventTypes {
  online = 'online',
  offline = 'offline',
}

export enum EventStatus {
  active = 'active',
  inactive = 'inactive',
  completed = 'completed',
}

export type MeetingDetails = {
  id: string;
  url: string;
  password: string;
};
