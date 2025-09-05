// Event service configuration - now controlled at event level via createEventDto.isMeetingNew
export interface EventServiceConfig {
  // Mode is now determined per event using createEventDto.isMeetingNew
  // true = Create new meeting automatically (DIRECT_INTEGRATION)
  // false = Use existing meeting details (EVENT_MANAGEMENT)
}

export const getEventServiceConfig = (): EventServiceConfig => ({
  // Configuration is now event-level, not service-level
});
