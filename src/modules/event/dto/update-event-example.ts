const updateEventsExamples: Record<
  string,
  {
    status?: string;
    title: string;
    startTime?: string;
    isMainEvent: boolean;
    onlineProvider?: string;
    onlineDetails?: any;
    meetingType?: string;
    approvalType?: number;
    timezone?: string;
    platformIntegration?: boolean;
    startDatetime: string;
    endDatetime: string;
    location?: string;
    longitude?: string;
    latitude?: string;
    recurrencePattern?: any;
    erMetaData?: any;
    metadata?: any;
    updatedBy?: string;
  }
> = {
  EditThisAndFollowingWeeklyOnline: {
    // isRecurring is true in db
    isMainEvent: true,
    title: 'Modify following events',
    startDatetime: '2024-12-20T02:00:00Z',
    endDatetime: '2024-12-20T03:00:00Z',
    onlineProvider: 'Zoom',
    meetingType: 'meeting',
    approvalType: 0,
    timezone: 'Asia/Kolkata',
    platformIntegration: true,
    onlineDetails: {
      id: '123-456-0000',
      url: 'http://zoom.us/j/mymeeting?pwd=xyz',
      password: 'xxxxxxx',
      occurrenceId: '',
      providerGenerated: false,
    },
    erMetaData: {
      topic: '#',
      subTopic: 'Type of C',
      mentorId: '1244546647',
    },
    recurrencePattern: {
      frequency: 'weekly',
      interval: 2,
      daysOfWeek: [3, 5], //  Wednesday ,friday
      recurringStartDate: '2024-12-06T02:00:00Z',
      endCondition: {
        type: 'endDate',
        value: '2024-12-30T03:00:00Z',
      },
    },
  },
  EditThisWeeklyOnline: {
    // isRecurring is true in db
    isMainEvent: false,
    title: 'Modify this event ie 0c8abb6b-02c3-4eb3-88df-b58d9027958e ',
    startDatetime: '2024-12-21T02:00:00Z',
    endDatetime: '2024-12-21T03:00:00Z',
    onlineProvider: 'GoogleMeet',
    meetingType: 'meeting',
    approvalType: 1,
    timezone: 'America/New_York',
    platformIntegration: false,
    onlineDetails: {
      id: '123-456-0000',
      url: 'https://meet.google.com/hex-uqed-zpp',
      password: 'xxxxxxx',
      occurrenceId: '',
      providerGenerated: false,
    },
    erMetaData: {
      topic: '#',
      subTopic: 'Type of C',
      mentorId: '1244546647',
    },
  },
  EditThisOneDayOnline: {
    isMainEvent: true,
    title: 'Modify this event ie 0c8abb6b-02c3-4eb3-88df-b58d9027958e ',
    startDatetime: '2024-12-21T02:00:00Z',
    endDatetime: '2024-12-21T03:00:00Z',
    onlineProvider: 'GoogleMeet',
    meetingType: 'webinar',
    approvalType: 2,
    timezone: 'Europe/London',
    platformIntegration: true,
    onlineDetails: {
      id: '123-456-0000',
      url: 'https://meet.google.com/hex-uqed-zpp',
      password: 'xxxxxxx',
      occurrenceId: '',
      providerGenerated: false,
    },
    erMetaData: {
      topic: '#',
      subTopic: 'Type of C',
      mentorId: '1244546647',
    },
  },
  EditThisAndFollowingWeeklyOffline: {
    // isRecurring is true in db
    isMainEvent: true,
    title: 'Modify following events',
    startDatetime: '2024-12-20T02:00:00Z',
    endDatetime: '2024-12-20T03:00:00Z',
    location: 'Pune',
    recurrencePattern: {
      endCondition: {
        type: 'endDate',
        value: '2024-12-25T03:00:00Z',
      },
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [2, 1, 3],
      recurringStartDate: '2024-12-19T02:00:00Z',
    },
    metadata: {
      category: 'Recurring online',
      courseType: 'Foundation Course',
      subject: 'Basic Language',
      teacherName: 'Sudhakar',
      cohortId: '2447aa0c-4111-4cb9-94d1-9898ef6975a1',
      cycleId: '',
      tenantId: '',
    },
    erMetaData: {
      topic: '#',
      subTopic: 'Type of C',
      mentorId: '1244546647',
    },
  },
  EditThisWeeklyOffline: {
    // isRecurring is true in db
    isMainEvent: false,
    title: 'Modify this event in other recurring events',
    startDatetime: '2024-12-29T02:00:00Z',
    endDatetime: '2024-12-29T04:00:00Z',
    location: 'Chandani Chowk',
    metadata: {
      category: 'Recurring online',
      courseType: 'Foundation Course',
      subject: 'Basic Language',
      teacherName: 'Sudhakar',
      cohortId: '2447aa0c-4111-4cb9-94d1-9898ef6975a1',
      cycleId: '',
      tenantId: '',
    },
    erMetaData: {
      topic: '#',
      subTopic: 'Type of C',
      mentorId: '1244546647',
    },
  },
  EditThisOneDayOffline: {
    isMainEvent: true,
    title: 'Modify this event ie  ',
    startDatetime: '2024-12-29T02:00:00Z',
    endDatetime: '2024-12-29T04:00:00Z',
    location: 'Chandani Chowk',
    metadata: {
      category: 'Recurring online',
      courseType: 'Foundation Course',
      subject: 'Basic Language',
      teacherName: 'Sudhakar',
      cohortId: '2447aa0c-4111-4cb9-94d1-9898ef6975a1',
      cycleId: '',
      tenantId: '',
    },
    erMetaData: {
      topic: '#',
      subTopic: 'Type of C',
      mentorId: '1244546647',
    },
  },
  UpdateWithPlatformIntegration: {
    isMainEvent: true,
    title: 'Update Event with Platform Integration',
    startDatetime: '2024-12-21T02:00:00Z',
    endDatetime: '2024-12-21T03:00:00Z',
    onlineProvider: 'Zoom',
    meetingType: 'webinar',
    approvalType: 1,
    timezone: 'Europe/London',
    platformIntegration: true,
    onlineDetails: {
      id: '123-456-0000',
      url: 'https://zoom.us/j/updated-meeting',
      password: 'newpassword',
      occurrenceId: '',
      providerGenerated: false,
    },
  },
  UpdateWithoutPlatformIntegration: {
    isMainEvent: false,
    title: 'Update Event without Platform Integration',
    startDatetime: '2024-12-21T02:00:00Z',
    endDatetime: '2024-12-21T03:00:00Z',
    onlineProvider: 'Zoom',
    meetingType: 'meeting',
    approvalType: 0,
    timezone: 'Asia/Kolkata',
    platformIntegration: false,
    onlineDetails: {
      id: '123-456-0000',
      url: 'https://zoom.us/j/local-update-only',
      password: 'localpassword',
      occurrenceId: '',
      providerGenerated: false,
    },
  },
};

export const updateEventsExamplesForSwagger = Object.entries(
  updateEventsExamples,
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
