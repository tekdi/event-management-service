export interface IOnlineMeetingLocator {
  getToken: () => Promise<string>;
  getMeetingParticipantList: (
    token: string,
    userArray: any[],
    meetingId: string,
    url: string,
  ) => Promise<any>;
}
