export interface AttendanceJobData {
  eventRepetitionId: string;
  authToken: string;
  userId?: string; // Optional: for manual triggers
  useMockData?: boolean; // Use mock data instead of real Zoom API
  mockDataFile?: string; // JSON file name in data/mock-json/ directory
}

export interface AttendanceJobResult {
  totalParticipants: number;
  participantsProcessed: number;
  participantsAttended: number;
  participantsNotAttended: number;
  newAttendeeRecords: number;
  updatedAttendeeRecords: number;
  duration: number; // Processing time in seconds
}

