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