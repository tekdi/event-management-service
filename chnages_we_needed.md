# Event Management Service - Event-Level Control Implementation

## 🎯 **Overview**

This document outlines the implementation of **event-level control** for the Event Management Service, replacing the previous service-level `EVENT_SERVICE_MODE` configuration. Now each event can independently decide whether to create new meetings or use existing ones.

## 🔄 **Key Changes**

### **1. Removed Service-Level Configuration**
- ❌ **Removed**: `EVENT_SERVICE_MODE` environment variable
- ❌ **Removed**: Service-wide mode configuration
- ✅ **Added**: Event-level control via `createEventDto.isMeetingNew`

### **2. Event-Level Control**
Each event request now controls its own behavior:

```typescript
// Event 1: Use existing meeting (EVENT_MANAGEMENT behavior)
{
  isMeetingNew: false,
  onlineDetails: { id: "123", url: "https://zoom.us/j/123" }
}

// Event 2: Create new meeting (DIRECT_INTEGRATION behavior)
{
  isMeetingNew: true,
  // onlineDetails will be auto-generated
}

// Event 3: Use existing webinar
{
  isMeetingNew: false,
  onlineDetails: { id: "456", url: "https://zoom.us/w/456" }
}
```

## 🏗️ **Architecture Changes**

### **Before: Service-Level Control**
```typescript
// Environment variable controlled entire service
EVENT_SERVICE_MODE=EVENT_MANAGEMENT

// All events had to follow the same mode
if (mode === 'EVENT_MANAGEMENT') {
  // Strict validation for all events
} else {
  // Relaxed validation for all events
}
```

### **After: Event-Level Control**
```typescript
// No environment variable needed
// Each event decides its own behavior

if (createEventDto.isMeetingNew === false) {
  // Strict validation (existing meeting)
  validateExistingMeetingRequirements();
} else {
  // Relaxed validation (new meeting creation)
  validateNewMeetingRequirements();
}
```

## 📋 **Validation Rules by Event Type**

### **Private Events (`isRestricted: true`)**

#### **Using Existing Meeting (`isMeetingNew: false`)**
- ✅ **Strict Validation**: Invitees are required
- ✅ **Error**: If no attendees provided
- ✅ **Use Case**: Managing existing private meetings

#### **Creating New Meeting (`isMeetingNew: true`)**
- ✅ **Relaxed Validation**: No strict attendee requirements
- ✅ **Focus**: Meeting creation and configuration
- ✅ **Use Case**: Setting up new private meetings

### **Public Events (`isRestricted: false`)**

#### **Using Existing Meeting (`isMeetingNew: false`)**
- ✅ **Strict Validation**: Registration dates are required
- ✅ **Error**: If registration dates missing
- ✅ **Use Case**: Managing existing public events

#### **Creating New Meeting (`isMeetingNew: true`)**
- ✅ **Relaxed Validation**: Registration dates are recommended but not required
- ✅ **Warning**: Logged if registration dates missing
- ✅ **Use Case**: Setting up new public events

## 🔧 **Implementation Details**

### **1. Removed Files/Configurations**
- ❌ `EVENT_SERVICE_MODE` environment variable
- ❌ `getEventServiceConfig()` function
- ❌ Mode-based validation logic
- ❌ Service-level operation mode

### **2. Updated Validation Logic**
```typescript
private async validatePrivacyRequirements(createEventDto: CreateEventDto): Promise<void> {
  // Apply validation rules based on event properties, not service mode
  
  if (createEventDto.isRestricted === true) {
    // Private Event Validation
    if (createEventDto.isMeetingNew === false) {
      // Using existing meeting: Strict validation
      if (!createEventDto.attendees || createEventDto.attendees.length === 0) {
        throw new BadRequestException(
          'Private events using existing meetings require invitees.'
        );
      }
    }
    // If isMeetingNew === true: No strict validation
  } else if (createEventDto.isRestricted === false) {
    // Public Event Validation
    if (createEventDto.isMeetingNew === false) {
      // Using existing meeting: Strict validation
      if (!createEventDto.registrationStartDate || !createEventDto.registrationEndDate) {
        throw new BadRequestException(
          'Public events using existing meetings require registration dates.'
        );
      }
    } else {
      // Creating new meeting: Relaxed validation with warning
      if (!createEventDto.registrationStartDate || !createEventDto.registrationEndDate) {
        LoggerWinston.warn(
          'Public events creating new meetings should include registration dates for better user experience.',
          API_ID.CREATE_EVENT,
        );
      }
    }
  }
}
```

### **3. Event Creation Flow**
```typescript
async createOfflineOrOnlineEvent(createEventDto: CreateEventDto) {
  if (createEventDto.eventType === EventTypes.offline) {
    // Offline event handling
    createEventDto.onlineProvider = null;
    createEventDto.onlineDetails = null;
    createEventDto.recordings = null;
  } else if (createEventDto.eventType === EventTypes.online) {
    if (createEventDto.isMeetingNew === false) {
      // Use existing meeting details
      createEventDto.onlineDetails.providerGenerated = false;
      createEventDto.onlineDetails.meetingType = createEventDto.meetingType || MeetingType.meeting;
  } else {
      // Create new meeting automatically
      createEventDto = await this.createNewMeeting(createEventDto);
    }
  }
  // ... rest of the logic
}
```

## 🆕 **Enhanced Update Event Functionality**

### **New Update Fields**
The update event endpoint now supports enhanced online meeting fields:

```typescript
// UpdateEventDto now includes:
- meetingType?: MeetingType;        // 'meeting' | 'webinar'
- approvalType?: ApprovalType;      // 0 | 1 | 2 (Automatic | Manual | No Registration)
- timezone?: string;                // 'America/New_York', 'Asia/Kolkata', etc.
- platformIntegration?: boolean;    // Whether to sync with Zoom API (default: true)
```

### **Platform Integration Control**
The `platformIntegration` parameter gives users full control over whether to sync with the meeting provider (Zoom) or just update local data:

#### **With Platform Integration (`platformIntegration: true` or undefined)**
```json
{
  "title": "Updated Meeting Title",
  "meetingType": "webinar",
  "platformIntegration": true
}
```
**Result**: 
- ✅ Database updated
- ✅ Zoom meeting updated via API
- ✅ **onlineDetails validation SKIPPED** (details come from Zoom API)
- ✅ **Local database synced with actual Zoom data**
- ✅ Meeting shows new title in Zoom

#### **Without Platform Integration (`platformIntegration: false`)**
```json
{
  "title": "Updated Meeting Title",
  "meetingType": "webinar",
  "platformIntegration": false
}
```
**Result**: 
- ✅ Database updated
- ❌ Zoom meeting unchanged
- ✅ **onlineDetails validation REQUIRED** (manual input)
- ❌ Meeting still shows old title in Zoom

### **Update Event Examples**

#### **Update Meeting Type with Platform Integration**
```json
{
  "title": "Updated Meeting Title",
  "meetingType": "webinar",
  "platformIntegration": true,
  "isMainEvent": true
}
```

#### **Update Approval Settings without Platform Integration**
```json
{
  "approvalType": 1,
  "timezone": "Europe/London",
  "platformIntegration": false,
  "isMainEvent": false
}
```

#### **Update Online Details with Platform Integration**
```json
{
  "onlineDetails": {
    "url": "https://zoom.us/j/updated-meeting",
    "password": "newpassword"
  },
  "platformIntegration": true,
  "isMainEvent": true
}
```

### **Enhanced Validation**
- ✅ **Online Field Validation**: `meetingType`, `approvalType`, and `timezone` are only allowed for online events
- ✅ **Consistent Validation**: Same validation pipes used for both create and update endpoints
- ✅ **Field-Level Control**: Each field can be updated independently
- ✅ **Platform Integration Control**: Users can choose whether to sync with Zoom

### **Update Method Enhancements**
Both `handleAllEventUpdate` and `handleSpecificRecurrenceUpdate` now support:
- Individual field updates (`meetingType`, `approvalType`, `timezone`)
- Proper `onlineDetails` object management
- Consistent update result formatting
- **Zoom API integration based on `platformIntegration` parameter**
- **Error handling for API failures** (continues with local update)

## 🚀 **Platform Integration Control for Create Events**

### **New Create Event Parameter**
The create event endpoint now also supports the `platformIntegration` parameter:

```typescript
// CreateEventDto now includes:
- platformIntegration?: boolean;    // Whether to create Zoom meetings (default: true)
```

### **Create Event Scenarios**

#### **Create Event with Zoom Integration (`platformIntegration: true`)**
```json
{
  "title": "Team Meeting",
  "eventType": "online",
  "onlineProvider": "Zoom",
  "isMeetingNew": true,
  "meetingType": "meeting",
  "platformIntegration": true
}
```
**Result**: 
- ✅ Event created in database
- ✅ Zoom meeting created via API
- ✅ Real meeting URL and credentials

#### **Create Event without Zoom Integration (`platformIntegration: false`)**
```json
{
  "title": "Local Meeting",
  "eventType": "online",
  "onlineProvider": "Zoom",
  "isMeetingNew": true,
  "meetingType": "meeting",
  "platformIntegration": false
}
```
**Result**: 
- ✅ Event created in database
- ❌ No Zoom API call
- ✅ Local placeholder meeting details

### **Benefits of Platform Integration Control**

#### **1. Flexible Deployment**
- **Development**: Use `platformIntegration: false` for testing without Zoom API calls
- **Staging**: Use `platformIntegration: true` for full integration testing
- **Production**: Let users choose based on their needs

#### **2. Cost Control**
- **API Limits**: Avoid hitting Zoom API rate limits during development
- **Testing**: Create events without consuming Zoom meeting quotas
- **Fallback**: Continue working even if Zoom API is temporarily unavailable

#### **3. User Choice**
- **Full Integration**: Users who want real Zoom meetings
- **Local Only**: Users who want to manage meetings manually
- **Hybrid Approach**: Mix both approaches in the same system

## 🎯 **Benefits of Event-Level Control**

### **1. Flexibility**
- ✅ **Mixed Usage**: Same service can handle both scenarios simultaneously
- ✅ **Event Independence**: Each event decides its own behavior
- ✅ **No Service Restart**: Handle different event types without configuration changes

### **2. Better User Experience**
- ✅ **Granular Control**: Users can choose per event whether to create or use existing
- ✅ **Appropriate Validation**: Validation level matches the event's intent
- ✅ **Clear Feedback**: Specific error messages based on event type

### **3. Operational Efficiency**
- ✅ **No Configuration Changes**: Handle different event types without environment updates
- ✅ **Scalable**: Easy to add new event types with different behaviors
- ✅ **Maintainable**: Simpler logic without mode-based branching

## 📝 **Usage Examples**

### **Scenario 1: Mixed Event Types**
```typescript
// Create multiple events with different behaviors
const events = [
  {
    title: "Existing Team Meeting",
    isMeetingNew: false,
    onlineDetails: { id: "123", url: "https://zoom.us/j/123" }
  },
  {
    title: "New Product Launch",
    isMeetingNew: true,
    // Will auto-create Zoom meeting
  },
  {
    title: "Existing Webinar",
    isMeetingNew: false,
    onlineDetails: { id: "456", url: "https://zoom.us/w/456" }
  }
];
```

### **Scenario 2: Dynamic Event Creation**
```typescript
// Same service can handle different event creation patterns
if (userWantsNewMeeting) {
  createEventDto.isMeetingNew = true;
  // Service will create new meeting automatically
} else {
  createEventDto.isMeetingNew = false;
  createEventDto.onlineDetails = existingMeetingDetails;
  // Service will use existing meeting
}
```

### **Scenario 3: Enhanced Event Updates**
```typescript
// Update existing events with new capabilities
const updateData = {
  title: "Updated Meeting Title",
  meetingType: "webinar",
  approvalType: 1,
  timezone: "Europe/London",
  onlineDetails: {
    url: "https://zoom.us/j/updated-meeting"
  }
};
```

## 🚀 **Migration Guide**

### **For Existing Code**
1. **Remove** any references to `EVENT_SERVICE_MODE`
2. **Update** event creation to use `isMeetingNew` field
3. **Ensure** `onlineDetails` is provided when `isMeetingNew: false`
4. **Test** both scenarios (new and existing meetings)

### **For New Events**
1. **Set** `isMeetingNew: true` to auto-create meetings
2. **Set** `isMeetingNew: false` and provide `onlineDetails` for existing meetings
3. **Follow** appropriate validation rules based on event type

### **For Event Updates**
1. **Use** new fields (`meetingType`, `approvalType`, `timezone`) for enhanced control
2. **Leverage** individual field updates for granular control
3. **Maintain** consistency with create event validation

## ✅ **Summary**

The Event Management Service now provides **event-level control** instead of service-level configuration:

- **`isMeetingNew: false`** → EVENT_MANAGEMENT behavior (strict validation, use existing)
- **`isMeetingNew: true`** → DIRECT_INTEGRATION behavior (relaxed validation, create new)
- **Enhanced Updates** → Support for `meetingType`, `approvalType`, and `timezone` updates
- **Mixed Usage**: Same service can handle both scenarios simultaneously
- **Better UX**: Appropriate validation and error messages per event
- **Operational Efficiency**: No configuration changes needed for different event types

This approach provides maximum flexibility while maintaining appropriate validation levels for each event type! 🎉

## 🔄 **Enhanced Workflow with Platform Integration**

### **When `platformIntegration: true` (Default Behavior)**

#### **1. Validation Behavior**
- ✅ **onlineDetails validation SKIPPED** - No need to provide meeting details
- ✅ **Basic field validation** - Title, dates, etc. still validated
- ✅ **Zoom API integration** - Meeting updated via Zoom API

#### **2. Update Flow**
```typescript
// 1. User sends update request
{
  "title": "Updated Meeting Title",
  "meetingType": "webinar",
  "platformIntegration": true
}

// 2. System updates Zoom meeting via API and gets response
const updateResponse = await adapter.updateMeeting(meetingId, updateData, meetingType);

// 3. System checks if response contains full meeting details
let meetingDetails = updateResponse;
if (!updateResponse || !updateResponse.id || !updateResponse.join_url) {
  // Fallback: fetch updated meeting details
  meetingDetails = await adapter.getMeetingDetails(meetingId, meetingType);
}

// 4. System syncs Zoom data back to local database
eventRepetition.onlineDetails = {
  id: meetingDetails.id,
  url: meetingDetails.join_url,
  password: meetingDetails.password,
  providerGenerated: true,
  // ... other fields synced from Zoom
};

// 5. Local database updated with actual Zoom data
await this.eventRepetitionRepository.save(eventRepetition);
```

#### **3. Benefits**
- 🎯 **Single Source of Truth**: Zoom API is the authoritative source
- 🔄 **Automatic Sync**: Local data always matches Zoom data
- ✅ **No Validation Errors**: onlineDetails validation skipped
- 🚀 **Real-time Updates**: Changes immediately reflected in Zoom

### **When `platformIntegration: false`**

#### **1. Validation Behavior**
- ✅ **onlineDetails validation REQUIRED** - Must provide valid meeting details
- ✅ **Basic field validation** - Title, dates, etc. validated
- ❌ **No Zoom API integration** - Local updates only

#### **2. Update Flow**
```typescript
// 1. User sends update request
{
  "title": "Updated Meeting Title",
  "onlineDetails": {
    "url": "https://zoom.us/j/updated-meeting",
    "password": "newpassword"
  },
  "platformIntegration": false
}

// 2. System validates onlineDetails
@ValidateIf((o) => o.onlineProvider != undefined && o.platformIntegration !== true)
onlineDetails?: OnlineDetailsDto;

// 3. System updates local database only
eventRepetition.onlineDetails = updateBody.onlineDetails;

// 4. No Zoom API calls made
// 5. Local and Zoom data may diverge
```

#### **3. Use Cases**
- 🧪 **Development & Testing**: No external API dependencies
- 📝 **Manual Management**: Users manage meeting details manually
- 🚫 **API Unavailable**: When Zoom API is down or rate-limited
- 💰 **Cost Control**: Avoid API quota consumption

## 🔧 **Technical Implementation Details**

### **Validation Logic**
```typescript
// UpdateEventDto - onlineDetails validation
@ValidateIf((o) => o.onlineProvider != undefined && o.platformIntegration !== true)
onlineDetails?: OnlineDetailsDto;

// Meaning: Skip validation if platformIntegration is true
// Because details will come from Zoom API, not user input
```

### **Zoom Data Sync**
```typescript
// After successful Zoom API update
if (updatedZoomDetails) {
  // Sync local database with actual Zoom data
  eventRepetition.onlineDetails = {
    ...eventRepetition.onlineDetails,
    id: updatedZoomDetails.id,
    url: updatedZoomDetails.join_url,
    start_url: updatedZoomDetails.start_url,
    registration_url: updatedZoomDetails.registration_url,
    password: updatedZoomDetails.password,
    providerGenerated: true, // Mark as Zoom-generated
    meetingType: updateBody.meetingType,
    approvalType: updateBody.approvalType,
    timezone: updateBody.timezone,
    params: updatedZoomDetails, // Store full Zoom response
  };
}
```

### **Error Handling**
```typescript
try {
  // Update Zoom meeting via API
  const updatedZoomDetails = await this.updateZoomMeeting(...);
  
  // Sync data back to local database
  if (updatedZoomDetails) {
    // Update local with Zoom data
  }
  
  updateResult.zoomApiUpdated = true;
} catch (error) {
  // API failed but continue with local update
  updateResult.zoomApiError = error.message;
  LoggerWinston.error('Failed to update Zoom meeting via API');
}
```
