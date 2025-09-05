# Event Management Service - Enhanced Zoom Integration & Provider Architecture

## 🎯 **Overview**

This document outlines the comprehensive enhancement of the Event Management Service with **advanced Zoom integration capabilities** and a **provider-based architecture** for online meeting adapters. The implementation includes full CRUD operations for meetings and webinars, enhanced authentication methods, and robust error handling.

## 🔄 **Key Changes**

### **1. Enhanced Zoom Integration**
- ✅ **Added**: Complete Zoom API integration with meetings and webinars
- ✅ **Added**: Server-to-Server OAuth authentication support
- ✅ **Added**: Full CRUD operations (Create, Read, Update, Delete)
- ✅ **Added**: Enhanced error handling and categorization
- ✅ **Added**: Token caching and management

### **2. Provider-Based Architecture**
- ✅ **Added**: Provider registry system for online meeting adapters
- ✅ **Added**: Support for multiple meeting providers
- ✅ **Added**: Provider enable/disable functionality
- ✅ **Added**: Dynamic provider selection

### **3. Meeting Management Capabilities**
```typescript
// Create new meeting
{
  topic: "Team Meeting",
  startTime: "2024-01-01T10:00:00Z",
  duration: 60,
  meetingType: "meeting", // or "webinar"
  approvalType: 0, // 0=Automatic, 1=Manual, 2=No Registration
  timezone: "America/New_York"
}

// Update existing meeting
{
  topic: "Updated Meeting Title",
  meetingType: "webinar",
  approvalType: 1,
  timezone: "Europe/London"
}

// Add registrant to meeting
{
  email: "user@example.com",
  first_name: "John",
  last_name: "Doe"
}
```

## 🏗️ **Architecture Changes**

### **Before: Basic Zoom Integration**
```typescript
// Simple HTTP service with basic authentication
constructor(
  private readonly httpService: HttpService,
  private readonly configService: ConfigService,
) {
  // Basic username/password authentication only
  this.username = this.configService.get('ZOOM_USERNAME');
  this.password = this.configService.get('ZOOM_PASSWORD');
}

// Limited functionality - only participant list retrieval
async getMeetingParticipantList(token: string, userArray: any[], meetingId: string) {
  // Basic participant fetching
}
```

### **After: Provider-Based Architecture with Enhanced Zoom Integration**
```typescript
// Provider registry system
export class OnlineMeetingModule {
  private providerRegistry = new Map<string, ProviderConfig>();
  
  registerProvider(key: string, config: ProviderConfig) {
    this.providerRegistry.set(key.toLowerCase(), config);
  }
  
  getProvider(key: string): IOnlineMeetingLocator {
    const provider = this.providerRegistry.get(key.toLowerCase());
    if (!provider) {
      throw new Error(`Provider '${key}' not found`);
    }
    if (!provider.enabled) {
      throw new Error(`Provider '${provider.name}' is currently disabled`);
    }
    return provider.adapter;
  }
}

// Enhanced Zoom adapter with full CRUD operations
export class ZoomService implements IOnlineMeetingLocator {
  // Support for both S2S OAuth and Username/Password
  private authMethod: AuthMethod;
  
  // Full meeting management
  async createMeeting(request: CreateMeetingRequest, meetingType: MeetingType)
  async updateMeeting(meetingId: string, request: Partial<CreateMeetingRequest>, meetingType: MeetingType)
  async deleteMeeting(meetingId: string, meetingType: MeetingType)
  async getMeetingDetails(meetingId: string, meetingType: MeetingType)
  async addRegistrantToMeeting(meetingId: string, registrantData: any, meetingType: MeetingType)
}
```

## 🔧 **Enhanced Zoom Integration Features**

### **1. Authentication Methods**

#### **Server-to-Server OAuth (Recommended)**
```typescript
// Environment variables for S2S OAuth
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_HOST_ID=your_host_id
ZOOM_API_BASE_URL=https://api.zoom.us/v2
ZOOM_MEETINGS_ENDPOINT=https://api.zoom.us/v2/users/me/meetings
ZOOM_WEBINARS_ENDPOINT=https://api.zoom.us/v2/users/me/webinars
```

**Benefits:**
- ✅ **Full API Access**: Create, update, delete meetings and webinars
- ✅ **Better Security**: OAuth tokens with expiration
- ✅ **Rate Limiting**: Higher API limits
- ✅ **Token Caching**: Automatic token refresh

#### **Username/Password (Legacy)**
```typescript
// Environment variables for legacy auth
ZOOM_USERNAME=your_username
ZOOM_PASSWORD=your_password
ZOOM_ACCOUNT_ID=your_account_id
```

**Limitations:**
- ❌ **Read-Only**: Only participant list retrieval
- ❌ **No Meeting Management**: Cannot create/update/delete meetings
- ❌ **Deprecated**: Zoom recommends migrating to S2S OAuth

### **2. Meeting Management Operations**

#### **Create Meeting/Webinar**
```typescript
const meetingRequest: CreateMeetingRequest = {
  topic: "Team Standup",
  startTime: "2024-01-01T10:00:00Z",
  duration: 30,
  password: "optional_password",
  timezone: "America/New_York",
  approvalType: ApprovalType.AUTOMATIC,
  settings: {
    hostVideo: true,
    participantVideo: true,
    joinBeforeHost: false,
    muteUponEntry: true,
    waitingRoom: false,
    autoRecording: "none"
  }
};

// Create meeting
const meeting = await zoomService.createMeeting(meetingRequest, MeetingType.meeting);

// Create webinar
const webinar = await zoomService.createMeeting(meetingRequest, MeetingType.webinar);
```

#### **Update Meeting/Webinar**
```typescript
const updateData = {
  topic: "Updated Meeting Title",
  duration: 60,
  settings: {
    waitingRoom: true,
    autoRecording: "local"
  }
};

await zoomService.updateMeeting(meetingId, updateData, MeetingType.meeting);
```

#### **Delete Meeting/Webinar**
```typescript
await zoomService.deleteMeeting(meetingId, MeetingType.webinar);
```

#### **Add Registrant**
```typescript
const registrantData = {
  email: "user@example.com",
  first_name: "John",
  last_name: "Doe"
};

await zoomService.addRegistrantToMeeting(meetingId, registrantData, MeetingType.webinar);
```

## 🔧 **Implementation Details**

### **1. New Files Added**
- ✅ `src/online-meeting-adapters/zoom/dto/participant-list-response.dto.ts`
- ✅ `src/online-meeting-adapters/zoom/dto/zoom-participant-response.dto.ts`
- ✅ Enhanced `src/online-meeting-adapters/onlineMeeting.locator.ts` interface
- ✅ Enhanced `src/online-meeting-adapters/zoom/zoom.adapter.ts` implementation

### **2. Enhanced Zoom Adapter Implementation**
```typescript
export class ZoomService implements IOnlineMeetingLocator {
  private readonly logger = new Logger(ZoomService.name);
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private authMethod: AuthMethod;

  constructor(private readonly configService: ConfigService) {
    // Auto-detect authentication method
    this.authMethod = this.determineAuthMethod();
  }

  private determineAuthMethod(): AuthMethod {
    const hasS2SCredentials = this.clientId && this.clientSecret && this.accountId;
    const hasUsernamePassword = this.username && this.password && this.accountId;
    
    if (hasS2SCredentials) {
      return AuthMethod.S2S_OAUTH;
    } else if (hasUsernamePassword) {
      return AuthMethod.USERNAME_PASSWORD;
    } else {
      throw new InternalServerErrorException(
        'Neither S2S OAuth nor Username/Password credentials are configured'
      );
    }
  }

  async getToken(): Promise<string> {
    // Token caching with automatic refresh
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }
    
    // Fetch new token and cache it
    const tokenResponse = await this.fetchNewToken();
    this.cachedToken = tokenResponse.access_token;
    this.tokenExpiry = Date.now() + (tokenResponse.expires_in - 60) * 1000;
    
    return this.cachedToken;
  }
}
```

### **3. Enhanced Error Handling**
```typescript
private categorizeZoomError(error: any, meetingType: MeetingType, operation: string): Error {
  let errorMessage = `Zoom ${meetingType} ${operation} failed`;
  let errorType = 'ZOOM_API_ERROR';

  if (error.response?.status === 400) {
    errorMessage = `Invalid data sent to Zoom API for ${meetingType} ${operation}`;
    errorType = 'ZOOM_BAD_REQUEST';
  } else if (error.response?.status === 401) {
    errorMessage = `Zoom authentication failed for ${meetingType} ${operation}`;
    errorType = 'ZOOM_UNAUTHORIZED';
  } else if (error.response?.status === 403) {
    errorMessage = `Insufficient permissions to ${operation} this Zoom ${meetingType}`;
    errorType = 'ZOOM_FORBIDDEN';
  } else if (error.response?.status === 404) {
    errorMessage = `Zoom ${meetingType} not found for ${operation}`;
    errorType = 'ZOOM_NOT_FOUND';
  } else if (error.response?.status === 429) {
    errorMessage = `Too many requests to Zoom API for ${meetingType} ${operation}`;
    errorType = 'ZOOM_RATE_LIMITED';
  }

  const enhancedError = new Error(errorMessage);
  (enhancedError as any).zoomErrorType = errorType;
  (enhancedError as any).originalError = error;
  (enhancedError as any).operation = operation;
  (enhancedError as any).meetingType = meetingType;

  return enhancedError;
}
```

### **4. Provider Registry System**
```typescript
export class OnlineMeetingModule {
  private providerRegistry = new Map<string, ProviderConfig>();

  registerProvider(key: string, config: ProviderConfig) {
    this.providerRegistry.set(key.toLowerCase(), config);
  }

  getProvider(key: string): IOnlineMeetingLocator {
    const provider = this.providerRegistry.get(key.toLowerCase());
    if (!provider) {
      const availableProviders = Array.from(this.providerRegistry.keys()).join(', ');
      throw new Error(`Provider '${key}' not found. Available providers: ${availableProviders}`);
    }
    if (!provider.enabled) {
      throw new Error(`Provider '${provider.name}' is currently disabled`);
    }
    return provider.adapter;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providerRegistry.keys());
  }

  isProviderEnabled(key: string): boolean {
    const provider = this.providerRegistry.get(key.toLowerCase());
    return provider?.enabled || false;
  }
}
```

## 📋 **New DTOs and Response Types**

### **1. Participant List Response DTO**
```typescript
export class ParticipantListResponseDto {
  @ApiProperty({
    description: 'Array of participant identifiers',
    example: ['user1@example.com', 'user2@example.com'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  identifiers: string[];

  @ApiProperty({
    description: 'Array of detailed participant information',
    example: [
      {
        id: 'user1@example.com',
        name: 'John Doe',
        join_time: '2023-01-01T10:00:00Z',
        leave_time: '2023-01-01T11:00:00Z',
        duration: 3600,
      },
    ],
    type: [Object],
  })
  @IsArray()
  inMeetingUserDetails: any[];

  @ApiProperty({
    description: 'Token for fetching the next page of results',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
    required: false,
  })
  @IsOptional()
  @IsString()
  next_page_token?: string;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  @IsNumber()
  page_count: number;

  @ApiProperty({
    description: 'Number of records per page',
    example: 300,
  })
  @IsNumber()
  page_size: number;

  @ApiProperty({
    description: 'Total number of records available',
    example: 100000,
  })
  @IsNumber()
  total_records: number;
}
```

### **2. Zoom Participant Response DTO**
```typescript
export class ZoomParticipantResponseDto {
  @ApiProperty({
    description: 'Array of participants from Zoom API',
    example: [
      {
        id: 'user1@example.com',
        user_id: '123456789',
        name: 'John Doe',
        user_email: 'user1@example.com',
        join_time: '2023-01-01T10:00:00Z',
        leave_time: '2023-01-01T11:00:00Z',
        duration: 3600,
        status: 'in_meeting',
      },
    ],
    type: [Object],
  })
  @IsArray()
  participants: any[];

  @ApiProperty({
    description: 'Token for fetching the next page of results',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
    required: false,
  })
  @IsOptional()
  @IsString()
  next_page_token?: string;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  @IsNumber()
  page_count: number;

  @ApiProperty({
    description: 'Number of records per page',
    example: 300,
  })
  @IsNumber()
  page_size: number;

  @ApiProperty({
    description: 'Total number of records available',
    example: 100000,
  })
  @IsNumber()
  total_records: number;
}
```

### **3. Enhanced Online Meeting Locator Interface**
```typescript
export interface CreateMeetingRequest {
  topic: string;
  startTime: string;
  duration: number;
  password?: string;
  timezone?: string;
  approvalType?: ApprovalType;
  settings?: {
    hostVideo?: boolean;
    participantVideo?: boolean;
    joinBeforeHost?: boolean;
    muteUponEntry?: boolean;
    watermark?: boolean;
    usePmi?: boolean;
    approvalType?: ApprovalType;
    audio?: string;
    autoRecording?: string;
    registrantsConfirmationEmail?: boolean;
    registrantsEmailNotification?: boolean;
    waitingRoom?: boolean;
    jbhTime?: number;
  };
}

export interface IOnlineMeetingLocator {
  // Authentication
  getToken: () => Promise<string>;

  // Meeting Management
  createMeeting: (
    request: CreateMeetingRequest,
    meetingType: MeetingType,
  ) => Promise<any>;
  updateMeeting: (
    meetingId: string,
    request: Partial<CreateMeetingRequest>,
    meetingType: MeetingType,
  ) => Promise<any>;
  deleteMeeting: (meetingId: string, meetingType: MeetingType) => Promise<void>;
  getMeetingDetails: (
    meetingId: string,
    meetingType: MeetingType,
  ) => Promise<any>;
  listMeetings: (meetingType: MeetingType, query?: any) => Promise<any>;

  // Participant Management
  getMeetingParticipantList: (
    token: string,
    userArray: any[],
    zoomId: string,
    meetingType: MeetingType,
    url?: string,
    pageSize?: number,
  ) => Promise<ZoomParticipantResponseDto>;

  getMeetingParticipantsIdentifiers: (
    meetingId: string,
    markAttendanceBy: string,
    meetingType: MeetingType,
    pageSize?: number,
  ) => Promise<ParticipantListResponseDto>;

  // Registrant Management
  addRegistrantToMeeting: (
    meetingId: string,
    registrantData: {
      email: string;
      first_name: string;
      last_name: string;
    },
    meetingType?: MeetingType,
  ) => Promise<any>;
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

## 🔧 **Environment Variables Configuration**

### **Required Environment Variables**

#### **For Server-to-Server OAuth (Recommended)**
```bash
# Zoom S2S OAuth Configuration
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
ZOOM_ACCOUNT_ID=your_zoom_account_id
ZOOM_HOST_ID=your_zoom_host_id

# Zoom API Endpoints
ZOOM_AUTH_URL=https://zoom.us/oauth/token
ZOOM_API_BASE_URL=https://api.zoom.us/v2
ZOOM_MEETINGS_ENDPOINT=https://api.zoom.us/v2/users/me/meetings
ZOOM_WEBINARS_ENDPOINT=https://api.zoom.us/v2/users/me/webinars

# Zoom Reporting Endpoints
ZOOM_PAST_MEETINGS=https://api.zoom.us/v2/report/meetings
ZOOM_PAST_WEBINARS=https://api.zoom.us/v2/report/webinars

# Online Meeting Adapter
ONLINE_MEETING_ADAPTER=zoom
```

#### **For Username/Password Authentication (Legacy)**
```bash
# Zoom Legacy Authentication
ZOOM_USERNAME=your_zoom_username
ZOOM_PASSWORD=your_zoom_password
ZOOM_ACCOUNT_ID=your_zoom_account_id

# Zoom API Endpoints
ZOOM_AUTH_URL=https://zoom.us/oauth/token
ZOOM_PAST_MEETINGS=https://api.zoom.us/v2/report/meetings
ZOOM_PAST_WEBINARS=https://api.zoom.us/v2/report/webinars

# Online Meeting Adapter
ONLINE_MEETING_ADAPTER=zoom
```

### **Environment Variable Validation**

The system automatically detects which authentication method to use based on available environment variables:

1. **S2S OAuth Priority**: If `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, and `ZOOM_ACCOUNT_ID` are present
2. **Username/Password Fallback**: If only `ZOOM_USERNAME`, `ZOOM_PASSWORD`, and `ZOOM_ACCOUNT_ID` are present
3. **Error**: If neither authentication method is properly configured

### **Feature Availability by Authentication Method**

| Feature | S2S OAuth | Username/Password |
|---------|-----------|-------------------|
| Create Meeting | ✅ | ❌ |
| Update Meeting | ✅ | ❌ |
| Delete Meeting | ✅ | ❌ |
| Get Meeting Details | ✅ | ❌ |
| List Meetings | ✅ | ❌ |
| Add Registrant | ✅ | ❌ |
| Get Participants | ✅ | ✅ |
| Get Participant Identifiers | ✅ | ✅ |

## ✅ **Summary**

The Event Management Service now provides **comprehensive Zoom integration** with a **provider-based architecture**:

- **🔐 Enhanced Authentication** → Support for both S2S OAuth and Username/Password authentication
- **📋 Full CRUD Operations** → Create, read, update, and delete meetings and webinars
- **🏗️ Provider Architecture** → Extensible system supporting multiple meeting providers
- **⚡ Token Management** → Automatic token caching and refresh
- **🛡️ Robust Error Handling** → Categorized error responses with detailed context
- **📊 Enhanced DTOs** → Structured response types for participant management
- **🔄 Meeting Management** → Complete lifecycle management for meetings and webinars
- **👥 Registrant Management** → Add and manage meeting/webinar registrants
- **📈 Scalable Design** → Easy to add new meeting providers and features

This implementation provides enterprise-grade Zoom integration with maximum flexibility and maintainability! 🎉

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
onlineDetails?: MeetingDetailsDto;

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
onlineDetails?: MeetingDetailsDto;

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
