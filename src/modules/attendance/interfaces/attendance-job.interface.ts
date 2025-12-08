export interface AttendanceJobData {
  eventRepetitionId: string;
  authToken: string;
  userId?: string; // Optional: for manual triggers
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

