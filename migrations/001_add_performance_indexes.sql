-- Performance indexes for high concurrency
-- Run this migration to optimize database queries

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_created_at ON "Events"("createdAt");
CREATE INDEX IF NOT EXISTS idx_events_updated_at ON "Events"("updatedAt");
CREATE INDEX IF NOT EXISTS idx_events_recurring ON "Events"("isRecurring", "recurrenceEndDate");
CREATE INDEX IF NOT EXISTS idx_events_detail_id ON "Events"("eventDetailId");
CREATE INDEX IF NOT EXISTS idx_events_created_by ON "Events"("createdBy");
CREATE INDEX IF NOT EXISTS idx_events_registration_dates ON "Events"("registrationStartDate", "registrationEndDate");

-- EventRepetition table indexes
CREATE INDEX IF NOT EXISTS idx_event_repetition_event_id ON "EventRepetition"("eventId");
CREATE INDEX IF NOT EXISTS idx_event_repetition_start_date ON "EventRepetition"("eventRepetitionStartDateTime");
CREATE INDEX IF NOT EXISTS idx_event_repetition_end_date ON "EventRepetition"("eventRepetitionEndDateTime");
CREATE INDEX IF NOT EXISTS idx_event_repetition_composite ON "EventRepetition"("eventId", "eventRepetitionStartDateTime");

-- EventDetail table indexes (assuming it exists)
CREATE INDEX IF NOT EXISTS idx_event_detail_status ON "EventDetail"("status");
CREATE INDEX IF NOT EXISTS idx_event_detail_type ON "EventDetail"("eventType");
CREATE INDEX IF NOT EXISTS idx_event_detail_provider ON "EventDetail"("onlineProvider");

-- EventAttendees table indexes
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON "EventAttendees"("userId");
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON "EventAttendees"("eventId");
CREATE INDEX IF NOT EXISTS idx_event_attendees_repetition_id ON "EventAttendees"("eventRepetitionId");
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON "EventAttendees"("status");
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_event ON "EventAttendees"("userId", "eventId");
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_repetition ON "EventAttendees"("userId", "eventRepetitionId");
CREATE INDEX IF NOT EXISTS idx_event_attendees_enrolled_at ON "EventAttendees"("enrolledAt");

-- RolePermissionMapping table indexes (assuming it exists)
CREATE INDEX IF NOT EXISTS idx_role_permission_role ON "RolePermissionMapping"("roleTitle");
CREATE INDEX IF NOT EXISTS idx_role_permission_path ON "RolePermissionMapping"("apiPath");
CREATE INDEX IF NOT EXISTS idx_role_permission_composite ON "RolePermissionMapping"("roleTitle", "apiPath");

-- Add comments for documentation
COMMENT ON INDEX idx_events_created_at IS 'Optimizes queries filtering by creation date';
COMMENT ON INDEX idx_events_recurring IS 'Optimizes recurring event queries';
COMMENT ON INDEX idx_event_attendees_user_event IS 'Optimizes user-event relationship queries';
COMMENT ON INDEX idx_role_permission_composite IS 'Optimizes permission middleware queries';

-- Analyze tables to update statistics
ANALYZE "Events";
ANALYZE "EventRepetition";
ANALYZE "EventAttendees";
