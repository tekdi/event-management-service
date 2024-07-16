export enum EventTypes {
  online = 'online',
  offline = 'offline',
}

export enum EventStatus {
  active = 'active',
  inactive = 'inactive',
  archived = 'archived',
}

export type MeetingDetails = {
  id: string;
  url: string;
  password: string;
};
