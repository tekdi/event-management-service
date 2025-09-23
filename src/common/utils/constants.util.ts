export const ERROR_MESSAGES = {
  INVALID_REQUEST: 'Invalid request',
  NOT_FOUND: 'Not found',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  BAD_REQUEST: 'Bad request',
  INVALID_REQUEST_BODY: 'Invalid request body',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  START_DATE_INVALID: 'Start and End date must be today or a future date',
  END_DATE_INVALID: 'End date time should be greater than start date time',
  REGISTRATION_DATE_INVALID: 'Registration date must be in the future',
  REGISTRATION_START_DATE_BEFORE_EVENT_DATE:
    'Registration start date must be before the event start date',
  REGISTRATION_END_DATE_BEFORE_EVENT_DATE:
    'Registration end date must be on or before the event start date',
  REGISTRATION_START_DATE_INVALID:
    'Registration start date must be in the future',
  REGISTRATION_END_DATE_INVALID: 'Registration end date must be in the future',
  REGISTRATION_START_DATE_BEFORE_END_DATE:
    'Registration start date must be before registration end date',
  RECURRENCE_END_DATE_INVALID:
    'Recurrence end date must be a valid ISO 8601 date string ',
  RECURRENCE_END_DATE_SHOULD_BE_GREATER_THAN_CURRENT_DATE:
    'Recurrence end date should be greater than current date',
  RECURRENCE_END_DATE_AFTER_EVENT_DATE:
    'Recurrence end date must be after the event start date',
  RECURRING_PATTERN_REQUIRED: 'Recurrence Pattern required for event',
  RECURRING_PATTERN_NOT_REQUIRED:
    'Recurrence Pattern not required for non recurring event',
  RECURRENCE_OCCURRENCES_INVALID:
    'Recurrence occurrences must be greater than 0',
  RECURRENCE_PATTERN_INVALID: 'Recurrence pattern invalid',
  MULTIDAY_EVENT_NOT_RECURRING: 'Multiday events cannot be recurring',
  REGISTRATION_START_DATE_REQUIRED:
    'Registration Start Date required for event',
  RESTRICTED_EVENT_NO_REGISTRATION_DATE:
    'Cannot have registration date for restricted event',
  ATTENDEES_REQUIRED: 'Attendees required for private event',
  ATTENDEES_NOT_REQUIRED: 'Attendees not required for public event',
  EVENT_NOT_FOUND: 'Event not found',
  EVENT_ATTENDEE_NOT_FOUND: 'Event attendee not found',
  EVENT_ATTENDEE_HISTORY_NOT_FOUND: 'Event attendee history not found',
  EVENT_ATTENDEE_HISTORY_ITEM_NOT_FOUND:
    'Event attendee history item not found',
  RECURRENCE_START_DATE_IN_FUTURE: 'Recurrence start date must be in future',
  END_DATE_CANNOT_CHANGE:
    'End Date cannot be changed because it is passed away',
  CANNOT_UPDATE_LOCATION_DETAILS_FOR_ONLINE_EVENT:
    'Cannot update location or latitude or longitude details for an online event',
  CANNOT_UPDATE_ONLINE_DETAILS_FOR_OFFLINE_EVENT:
    'Cannot update online details for an offline event',
  END_DATE_LESS_THAN_START_DATE:
    'End date is passed is less than recurring start date',
  CANNOT_PREPONE_PAST_EVENTS:
    'Cannot update events prepone not allowed for past events',
  CANNOT_EDIT_ARCHIVED_EVENTS: 'Cannot Edit archived events',
  ENDTIME_DOES_NOT_MATCH:
    'Event End time does not match with Recurrence Start or End time',
  PROVIDE_VALID_START_AND_END_DATETIME:
    'Please Provide Valid Start and End Date',
  RECURRENCE_PATTERN_MISSING: 'Recurring Pattern is missing for this event',
  CANNOT_PASS_MAIN_EVENT_FALSE:
    'You can not pass isMainEvent false because event is non recurring',
  EVENT_ALREADY_ARCHIVED: 'Event is already archived',
  EVENT_END_TIME_DOES_NOT_MATCH:
    'Event End time does not match with Recurrence End time',
  EVENT_START_TIME_DOES_NOT_MATCH:
    'Event Start time does not match with Recurrence Start time',
  ONLY_ONE_DATE_ALLOWED:
    'Only one of date, startDate, or endDate should be provided.',
  BOTH_AFTER_AND_BEFORE_REQUIRED:
    'Both "after" and "before" fields are required when date is provided.',
  BOTH_AFTER_AND_BEFORE_REQUIRED_FOR_STARTDATE:
    'Both "after" and "before" fields are required when startDate is provided.',
  BOTH_AFTER_AND_BEFORE_REQUIRED_FOR_ENDDATE:
    'Both "after" and "before" fields are required when endDate is provided.',
  AFTER_IN_START_AND_BEFORE_IN_END:
    'if StartDate and EndDate Provided then "after" fields is required in startDate and "before fields is required in endDate',
  AFTER_SHOULD_BE_LESS_THAN_BEFORE:
    '"after" should be less than or equal to "before" fields ',
  TIMEZONE_NOT_PROVIDED: 'Timezone not provided',
  CREATION_LIMIT_UNAVAILABLE: 'Event creation limit unavailable',
  CREATION_COUNT_EXCEEDED: 'Event Creation Count exceeded',
  RECURRENCE_PERIOD_INSUFFICIENT: 'Event recurrence period insufficient',
  PUBLIC_EVENTS: 'Public events not implemented!',
  DAILY_FREQUENCY: 'Daily frequency is not implemented yet',
  END_CONDITION_BY_OCCURRENCES:
    'End condition by occurrences is not implemented yet',
  EVENT_TYPE_CHANGE_NOT_SUPPORTED: 'Event type change not supported',
  USERID_INVALID: 'Invalid UserId',
  USERID_REQUIRED: 'UserId Required',
  PROVIDE_ONE_USERID_IN_QUERY: 'Please provide userId in query params',
  ENVIRONMENT_VARIABLES_MISSING: 'Environment variables missing!',
  USERS_NOT_FOUND_IN_SERVICE: 'Users not found in user service',
  SERVICE_NOT_FOUND: 'Service not found',
  NO_PARTICIPANTS_FOUND: 'No participants found for the meeting',
  MEETING_NOT_FOUND: 'Meeting not found',
  NO_USERS_FOUND: 'No users found in system',
  EVENT_DOES_NOT_EXIST: 'Event does not exist',
  INVALID_MARK_ATTENDANCE_BY:
    'Attendance can be marked on basis of email or name',
  USER_SERVICE_ERROR: 'Something went wrong in getting users',
  ATTENDANCE_SERVICE_ERROR: 'Something went wrong while marking attendance',
  TOKEN_MISSING_USERID: 'Token missing user identifier (sub)',
  AUTH_TOKEN_INVALID: 'Auth token invalid',
  AUTH_TOKEN_MISSING: 'Invalid or missing token',
  CANNOT_DELETE_ONLINE_MEETING: 'Failed to delete online meeting',
  API_REQ_FAILURE: (url: string) => `Error occurred on API Request: ${url}`,
  DB_QUERY_FAILURE: (url: string) => `Database Query Failed on API: ${url}`,
  API_FAILURE: (url: string) => `API Failure: ${url}`,
};

export const SUCCESS_MESSAGES = {
  EVENT_CREATED: 'Event created successfully',
  EVENT_UPDATED: 'Event updated successfully',
  EVENT_DELETED: 'Event deleted successfully',
  EVENT_ATTENDEE_CREATED: 'Event attendee created successfully',
  EVENT_ATTENDEE_UPDATED: 'Event attendee updated successfully',
  EVENT_ATTENDEE_DELETED: 'Event attendee deleted successfully',
  EVENT_ATTENDEE_HISTORY_ITEM_CREATED:
    'Event attendee history item created successfully',
  EVENT_ATTENDEE_HISTORY_ITEM_UPDATED:
    'Event attendee history item updated successfully',
  EVENT_ATTENDEE_HISTORY_ITEM_DELETED:
    'Event attendee history item deleted successfully',
  EVENT_CREATED_LOG: (url: string) => `Event created with ID: ${url}`,
  EVENTS_FETCHED_LOG: 'Successfully fetched events',
  EVENT_UPDATED_LOG: 'Successfully updated events',
  ATTENDANCE_MARKED_FOR_MEETING: 'Attendance marked for meeting',
};

export const API_ID = {
  CREATE_EVENT: 'api.event.create',
  GET_EVENT_BY_ID: 'api.event.getbyid',
  GET_EVENT_BY_REPETITION_ID: 'api.event.getbyrepetitionid',
  GET_EVENTS: 'api.events.get',
  UPDATE_EVENT: 'api.event.update',
  DELETE_EVENT: 'api.event.delete',
  GET_EVENT_ATTENDEES: 'api.event.attendees.get',
  GET_EVENT_ATTENDEE: 'api.event.attendee.get',
  CREATE_EVENT_ATTENDEE: 'api.event.attendee.create',
  UPDATE_EVENT_ATTENDEE: 'api.event.attendee.update',
  DELETE_EVENT_ATTENDEE: 'api.event.attendee.delete',
  GET_EVENT_ATTENDEE_HISTORY: 'api.event.attendee.history.get',
  GET_EVENT_ATTENDEE_HISTORY_ITEM: 'api.event.attendee.history.item.get',
  CREATE_EVENT_ATTENDEE_HISTORY_ITEM: 'api.event.attendee.history.item.create',
  UPDATE_EVENT_ATTENDEE_HISTORY_ITEM: 'api.event.attendee.history.item.update',
  DELETE_EVENT_ATTENDEE_HISTORY_ITEM: 'api.event.attendee.history.item.delete',
  MARK_EVENT_ATTENDANCE: 'api.event.mark.attendance',
  MARK_ATTENDANCE: 'api.event.attendance.mark',
};


export const testIds = [
  'e5a72396-5798-4e9e-9461-7ca2ee63c0d1',
'4e572304-23f0-40a9-bf19-c07069f05f71',
'2839cbd6-40d8-400c-bfd6-e452ecd54295',
'7fa48704-3adb-411c-88fa-3d3113ae7973',
'634a4a20-c87e-4769-a715-48954c198cad',
'cc29a49e-c5e9-492a-b3d1-df83e24bf0d5',
'7d0c6a19-3050-4c2d-9382-df976259371e',
'055ceed4-63f3-4053-a47b-44259b811974',
'580f79c0-9b0d-4741-89b6-66d8f4374d23',
'b2c36286-418b-48e7-9a03-5a6be2e397d4',
'06c8e7be-6364-45cb-872d-0842ee3f50b7',
'538f8d9c-4c4a-465f-a71b-0898d1f1a5bb',
'55900e50-061d-4ab2-b89e-1f6656966364',
'e6e08b1f-4b41-43f1-885e-195b81d8b9d6',
'393b727f-5a0b-4d02-b672-c1f243ed8d9d',
'b5f8661f-6d93-4187-87b8-38bb6e9ed834',
'00a001b9-978f-4e81-bfb5-26baa5ebd912',
'b50afcbe-174c-4d68-a39e-ff1da6c76b08',
'9618b3c2-b23a-45ec-bb3f-97f89bb0fba3',
'32016b68-36e6-45c9-a1a0-5982b71bd46d',
'90b79e33-6927-4e95-b3c1-90d98b7a2001',
'37ec4540-f592-4fcf-b96f-735b91262704',
'46fdf073-8577-4c00-af7b-33300a32e91e',
'4f2edcd0-a757-43ce-8b10-6657515a2c70',
'5a32ff3a-dc82-4a7d-a4cb-9880f418b660',
'cc28fd4f-730a-42b7-a4e4-aaeb4842807b',
'0e3e18fc-eb6b-4813-b752-47037615a3ba',
'e3d8b08e-5d55-4fd7-add9-538dc84f9652',
'e0d6d890-d4f7-4db3-bd17-3377e35a4651',
'97b8c747-8ac7-4231-a3cd-8fbf0704ee6f',
'013ac603-a79c-4de9-815c-d1600a285e0f',
'143e793a-bb5b-421c-9f5f-4194d0b7c76c',
'2f12b6a2-07b9-4c23-b355-03c678f30018',
'd7187a78-f6bc-4d3b-a3b6-781f9156f838',
'fdaf3987-7a65-4fb7-8c8a-4563c8241a11',
'bfc1905c-adf3-4aaa-af79-d1c4ca5ae1d2',
'5a95f48e-bcde-4763-88e8-ce2ba17a971d',
'f699f70b-27c7-409c-8bff-c18f3ce96a5b',
'8a53bde8-66d1-49fd-bda9-9cda6adce07e',
'4be15faa-a551-4c25-8adf-f54ed3c91f14',
'ddba88f9-6922-4a86-857a-53ec7ba72015',
'b9c217a1-763c-42b5-a020-4df479d3f854',
'a2122e68-862f-4e73-bce7-5a7dc9ead16e',
'302746c3-2e66-405e-9bc3-57df6926e1a5',
'99879fc6-b45e-45ca-9960-aefb994ef0f7',
'7e6677b3-7ed9-4dfb-afaa-1303e26ef05a',
'605a53a5-bce6-4b0f-8cdb-9eed14604c10',
'd9e59748-7d0c-425e-9e7c-41edb753bfcc',
'9ecf6e79-f7b7-4e98-b541-0d2f0f3712f4',
'118ab783-048c-44a5-924a-73d16a3ad365',
'c4cd1af5-b4c7-4976-a4fa-65c174e57b12',
'08c15130-b07d-442b-9db8-70ce0e8948e3'
  ];
