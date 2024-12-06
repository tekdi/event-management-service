const createEventsExamples: Record<
  string,
  {
    title: string;
    shortDescription: string;
    description: string;
    eventType: string;
    isRestricted: boolean;
    autoEnroll: boolean;
    startDatetime: string;
    endDatetime: string;
    location?: string;
    latitude?: string;
    longitude?: string;
    onlineProvider?: string;
    isMeetingNew?: boolean;
    meetingDetails?: any;
    maxAttendees?: any;
    attendees?: any[];
    recordings?: any;
    status: string;
    idealTime?: string;
    registrationStartDate?: string;
    registrationEndDate?: string;
    isRecurring: boolean;
    recurrencePattern?: any;
    metaData?: any;
    erMetaData?: any;
  }
> = {
  RecurringOnlineDailyByEndDate: {
    title: 'Sample OnlineDailyByEndDate Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'online',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    onlineProvider: 'Zoom',
    isMeetingNew: false,
    meetingDetails: {
      url: 'https://zoom.us/j/99201586505?pwd=ZA8uek6tYu0LQTPbW2GgIORpNDmv7j',
      id: 'meeting-id',
    },
    attendees: [],
    recordings: {
      url: 'https://zoom.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'daily',
      interval: 1,
      endCondition: {
        type: 'endDate',
        value: '2024-12-25T11:00:00Z',
      },
      recurringStartDate: '2024-03-18T10:00:00Z',
    },
    metaData: { cohortId: '3218bb35-a87d-4adf-b305-b205286fe320' },
    erMetaData: {},
  },
  RecurringOnlineDailyByOccurences: {
    title: 'Sample OnlineDailyByOccurences Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'online',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    onlineProvider: 'Zoom',
    isMeetingNew: false,
    meetingDetails: {
      url: 'https://zoom.us/j/99201586505?pwd=ZA8uek6tYu0LQTPbW2GgIORpNDmv7j',
      id: 'meeting-id',
    },
    attendees: [],
    recordings: {
      url: 'https://zoom.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'daily',
      interval: 1,
      endCondition: {
        type: 'occurrences',
        value: '20',
      },
      recurringStartDate: '2024-03-18T10:00:00Z',
    },
    metaData: { cohortId: '3218bb35-a87d-4adf-b305-b205286fe320' },
    erMetaData: {},
  },
  RecurringOfflineDailyByEndDate: {
    title: 'Sample OfflineDailyByEndDate Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'offline',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    location: 'Kothrud',
    // "maxAttendees": 100,
    attendees: [],
    recordings: {
      url: 'https://zoom.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'daily',
      interval: 1,
      endCondition: {
        type: 'endDate',
        value: '2024-12-25T11:00:00Z',
      },
      recurringStartDate: '2024-03-18T10:00:00Z',
    },
    metaData: {
      cohortId: '3218bb35-a87d-4adf-b305-b205286fe320',
    },
    erMetaData: {},
  },
  RecurringOfflineDailyByOccurrence: {
    title: 'Sample OfflineDailyByOccurrence Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'offline',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    location: 'Kothrud',
    attendees: [],
    recordings: {
      url: 'https://zoom.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'daily',
      interval: 1,
      endCondition: {
        type: 'occurrences',
        value: '20',
      },
      recurringStartDate: '2024-03-18T10:00:00Z',
    },
    metaData: {
      cohortId: '3218bb35-a87d-4adf-b305-b205286fe320',
    },
    erMetaData: {},
  },
  RecurringOnlineWeeklyByEndDate: {
    title: 'Sample OnlineWeeklyByEndDate Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'online',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    onlineProvider: 'Zoom',
    isMeetingNew: false,
    meetingDetails: {
      url: 'https://zoom.us/j/99201586505?pwd=ZA8uek6tYu0LQTPbW2GgIORpNDmv7j',
      id: 'meeting-id',
    },
    attendees: [],
    recordings: {
      url: 'https://example.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [3, 5], //  Wednesday ,friday
      endCondition: {
        type: 'endDate',
        value: '2024-12-25T11:00:00Z',
      },
      recurringStartDate: '2024-12-18T10:00:00Z',
    },
    metaData: {},
    erMetaData: {},
  },
  RecurringOnlineWeeklyByOccurences: {
    title: 'Sample OnlineWeeklyByOccurences Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'online',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    onlineProvider: 'Zoom',
    isMeetingNew: false,
    meetingDetails: {
      url: 'https://zoom.us/j/99201586505?pwd=ZA8uek6tYu0LQTPbW2GgIORpNDmv7j',
      id: 'meeting-id',
    },
    attendees: [],
    recordings: {
      url: 'https://example.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [3, 5], //  Wednesday ,friday
      endCondition: {
        type: 'occurrences',
        value: '20',
      },
      recurringStartDate: '2024-12-18T10:00:00Z',
    },
    metaData: {},
    erMetaData: {},
  },
  RecurringOfflineWeeklyByEndDate: {
    title: 'Sample Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'offline',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    location: 'Kothrud',
    attendees: [],
    recordings: {
      url: 'https://example.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [3, 5], //  Wednesday ,friday
      endCondition: {
        type: 'endDate',
        value: '2024-12-25T11:00:00Z',
      },
      recurringStartDate: '2024-12-18T10:00:00Z',
    },
    metaData: {},
    erMetaData: {},
  },
  RecurringOfflineWeeklyByOccurence: {
    title: 'Sample Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'offline',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    location: 'Kothrud',
    attendees: [],
    recordings: {
      url: 'https://example.com/recording',
    },
    status: 'live',
    isRecurring: true,
    recurrencePattern: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [3, 5], //  Wednesday ,friday
      endCondition: {
        type: 'occurrences',
        value: '20',
      },
      recurringStartDate: '2024-12-18T10:00:00Z',
    },
    metaData: {},
    erMetaData: {},
  },
  NonRecurringOffline: {
    title: 'Sample Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'offline',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    location: 'Kothrud',
    attendees: [],
    recordings: {
      url: 'https://example.com/recording',
    },
    status: 'live',
    isRecurring: false,
    metaData: {},
    erMetaData: {},
  },
  NonRecurringOnline: {
    title: 'Sample NonRecurringOnline Event',
    shortDescription: 'This is a sample event',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    eventType: 'online',
    isRestricted: true,
    autoEnroll: true,
    startDatetime: '2024-12-18T10:00:00Z',
    endDatetime: '2024-12-18T11:00:00Z',
    onlineProvider: 'Zoom',
    isMeetingNew: false,
    meetingDetails: {
      url: 'https://zoom.us/j/99201586505?pwd=ZA8uek6tYu0LQTPbW2GgIORpNDmv7j',
      id: 'meeting-id',
    },
    attendees: [],
    recordings: {
      url: 'https://example.com/recording',
    },
    status: 'live',
    isRecurring: false,
    metaData: {},
    erMetaData: {},
  },
};

export const createEventsExamplesForSwagger = Object.entries(
  createEventsExamples,
).reduce(
  (acc, [key, value]) => {
    acc[key] = {
      summary: `Example for ${key}`,
      description: `Detailed example for ${key}`,
      value, // Use the example value as-is
    };
    return acc;
  },
  {} as Record<string, { summary: string; description: string; value: any }>,
);
