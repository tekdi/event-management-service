import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  IOnlineMeetingLocator,
  CreateMeetingRequest,
} from '../onlineMeeting.locator';
import { ERROR_MESSAGES } from 'src/common/utils/constants.util';
import {
  AttendanceRecord,
  InZoomMeetingUserDetails,
  UserDetails,
  MeetingType,
  ApprovalType,
} from 'src/common/utils/types';
import { ParticipantListResponseDto } from '../zoom/dto/participant-list-response.dto';
import { ZoomParticipantResponseDto } from '../zoom/dto/zoom-participant-response.dto';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

interface MockParticipant {
  id: string;
  user_id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
  registrant_id: string;
  status: string;
  failover?: boolean;
  groupId?: string;
  internal_user?: boolean;
}

@Injectable()
export class MockZoomService implements IOnlineMeetingLocator {
  private readonly logger = new Logger(MockZoomService.name);
  private participantsData: MockParticipant[] = [];
  private readonly pageSize: number = 300;
  private csvFilePath: string;
  private currentMockDataFile: string | null = null;

  constructor(private readonly configService: ConfigService) {
    // Initialize with default file
    this.initializeDefaultFilePath();
    this.loadParticipantsFromCSV();
  }

  /**
   * Set mock data file dynamically (for per-request mock data)
   * @param fileName - JSON file name in data/mock-json/ directory
   */
  setMockDataFile(fileName: string): void {
    if (this.currentMockDataFile === fileName) {
      // Already loaded, skip
      return;
    }

    const jsonFilePath = path.join(
      process.cwd(),
      'data',
      'mock-json',
      fileName,
    );

    if (!fs.existsSync(jsonFilePath)) {
      this.logger.warn(
        `Mock data file not found: ${jsonFilePath}. Using default CSV file.`,
      );
      this.initializeDefaultFilePath();
      this.loadParticipantsFromCSV();
      return;
    }

    this.logger.log(`Loading mock data from JSON file: ${fileName}`);
    this.currentMockDataFile = fileName;
    this.loadParticipantsFromJSON(jsonFilePath);
  }

  /**
   * Initialize default CSV file path
   */
  private initializeDefaultFilePath(): void {
    const customPath = this.configService.get<string>('MOCK_ZOOM_CSV_PATH');
    const webinarPath = this.configService.get<string>('MOCK_WEBINAR_CSV_PATH');

    if (customPath) {
      this.csvFilePath = customPath;
    } else if (webinarPath) {
      this.csvFilePath = webinarPath;
    } else {
      // Default to webinar participants if available, otherwise regular participants
      const webinarDefault = path.join(
        process.cwd(),
        'data',
        'mock-webinar-participants.csv',
      );
      const regularDefault = path.join(
        process.cwd(),
        'data',
        'mock-participants.csv',
      );

      if (fs.existsSync(webinarDefault)) {
        this.csvFilePath = webinarDefault;
      } else {
        this.csvFilePath = regularDefault;
      }
    }
  }

  /**
   * Load participants data from CSV file
   * CSV format: registrant_id,user_email,name,join_time,leave_time,duration,status
   */
  private loadParticipantsFromCSV(): void {
    try {
      if (!fs.existsSync(this.csvFilePath)) {
        this.logger.warn(
          `CSV file not found at ${this.csvFilePath}. Creating sample data.`,
        );
        this.generateSampleData();
        return;
      }

      const csvContent = fs.readFileSync(this.csvFilePath, 'utf-8');
      const lines = csvContent.split('\n').filter((line) => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      this.participantsData = dataLines
        .map((line, index) => {
          const columns = line.split(',').map((col) => col.trim());
          
          if (columns.length < 7) {
            this.logger.warn(`Skipping invalid line ${index + 2}: ${line}`);
            return null;
          }

          const [registrantId, userEmail, name, joinTime, leaveTime, duration, status] = columns;

          return {
            id: `mock-${index + 1}`,
            user_id: `user-${index + 1}`,
            name: name || `Participant ${index + 1}`,
            user_email: userEmail || `participant${index + 1}@example.com`,
            join_time: joinTime || new Date().toISOString(),
            leave_time: leaveTime || new Date().toISOString(),
            duration: parseInt(duration) || Math.floor(Math.random() * 3600),
            registrant_id: registrantId || `reg-${index + 1}`,
            status: status || 'in_meeting',
            failover: false,
            groupId: '',
            internal_user: false,
          };
        })
        .filter((participant) => participant !== null) as MockParticipant[];

      this.logger.log(
        `Loaded ${this.participantsData.length} participants from CSV file`,
      );
    } catch (error) {
      this.logger.error(`Failed to load CSV file: ${error.message}`);
      this.logger.warn('Generating sample data instead');
      this.generateSampleData();
    }
  }

  /**
   * Load participants data from JSON file (Zoom API format)
   * JSON format: { participants: [...], total_records: number, ... }
   */
  private loadParticipantsFromJSON(jsonFilePath: string): void {
    try {
      const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
      const data = JSON.parse(jsonContent);

      // Handle both direct array and Zoom API response format
      let participants: any[] = [];
      if (Array.isArray(data)) {
        participants = data;
      } else if (data.participants && Array.isArray(data.participants)) {
        participants = data.participants;
      } else {
        throw new Error('Invalid JSON format: expected array or object with participants array');
      }

      this.participantsData = participants.map((p: any) => ({
        id: p.id || '',
        user_id: p.user_id || `user-${Date.now()}-${Math.random()}`,
        name: p.name || 'Unknown',
        user_email: p.user_email || '',
        join_time: p.join_time || new Date().toISOString(),
        leave_time: p.leave_time || new Date().toISOString(),
        duration: p.duration || 0,
        registrant_id: p.registrant_id || '',
        status: p.status || 'in_meeting',
        failover: p.failover || false,
        groupId: p.groupId || '',
        internal_user: p.internal_user || false,
      }));

      this.logger.log(
        `Loaded ${this.participantsData.length} participants from JSON file: ${jsonFilePath}`,
      );
    } catch (error) {
      this.logger.error(`Failed to load JSON file: ${error.message}`);
      this.logger.warn('Falling back to default CSV file');
      this.initializeDefaultFilePath();
      this.loadParticipantsFromCSV();
    }
  }

  /**
   * Generate sample data if CSV file doesn't exist
   * Creates 4000 sample participants
   */
  private generateSampleData(): void {
    const sampleCount = 4000;
    this.participantsData = [];

    for (let i = 1; i <= sampleCount; i++) {
      const joinTime = new Date(Date.now() - Math.random() * 86400000);
      const leaveTime = new Date(joinTime.getTime() + Math.random() * 3600000);
      const duration = Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000);

      this.participantsData.push({
        id: `mock-${i}`,
        user_id: `user-${i}`,
        name: `Participant ${i}`,
        user_email: `participant${i}@example.com`,
        join_time: joinTime.toISOString(),
        leave_time: leaveTime.toISOString(),
        duration: duration,
        registrant_id: `reg-${i}`,
        status: i % 10 === 0 ? 'left' : 'in_meeting',
        failover: false,
        groupId: '',
        internal_user: false,
      });
    }

    this.logger.log(`Generated ${sampleCount} sample participants`);
    
    // Optionally save to CSV for future use
    this.saveSampleDataToCSV();
  }

  /**
   * Save generated sample data to CSV file
   */
  private saveSampleDataToCSV(): void {
    try {
      const dir = path.dirname(this.csvFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const csvLines = [
        'registrant_id,user_email,name,join_time,leave_time,duration,status',
        ...this.participantsData.map(
          (p) =>
            `${p.registrant_id},${p.user_email},${p.name},${p.join_time},${p.leave_time},${p.duration},${p.status}`,
        ),
      ];

      fs.writeFileSync(this.csvFilePath, csvLines.join('\n'), 'utf-8');
      this.logger.log(`Saved sample data to ${this.csvFilePath}`);
    } catch (error) {
      this.logger.warn(`Failed to save CSV file: ${error.message}`);
    }
  }

  /**
   * Parse next_page_token to get page number
   * Token format: "page-{pageNumber}"
   */
  private parsePageToken(token?: string): number {
    if (!token || token === '') {
      return 1;
    }
    const match = token.match(/page-(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Generate next_page_token from page number
   */
  private generatePageToken(page: number): string | null {
    const totalPages = Math.ceil(this.participantsData.length / this.pageSize);
    if (page >= totalPages) {
      return null;
    }
    return `page-${page + 1}`;
  }

  // Implement IOnlineMeetingLocator interface methods

  async getToken(): Promise<string> {
    return 'mock-token';
  }

  async createMeeting(
    request: CreateMeetingRequest,
    meetingType: MeetingType,
  ): Promise<any> {
    return {
      id: `mock-${Date.now()}`,
      join_url: 'https://mock-zoom.us/j/mock-meeting',
      start_url: 'https://mock-zoom.us/s/mock-meeting',
      registration_url: 'https://mock-zoom.us/r/mock-meeting',
      password: 'mock123',
      meetingType,
    };
  }

  async updateMeeting(
    meetingId: string,
    request: Partial<CreateMeetingRequest>,
    meetingType: MeetingType,
  ): Promise<any> {
    return { success: true, meetingId, meetingType };
  }

  async deleteMeeting(
    meetingId: string,
    meetingType: MeetingType,
  ): Promise<void> {
    this.logger.log(`Mock delete meeting ${meetingId} (${meetingType})`);
  }

  async getMeetingDetails(
    meetingId: string,
    meetingType: MeetingType,
  ): Promise<any> {
    return {
      id: meetingId,
      topic: 'Mock Meeting',
      type: meetingType,
      start_time: new Date().toISOString(),
      duration: 60,
      timezone: 'UTC',
    };
  }

  async listMeetings(meetingType: MeetingType, query?: any): Promise<any> {
    return {
      meetings: [],
      page_count: 0,
      page_size: 30,
      total_records: 0,
    };
  }

  /**
   * Get participant list with pagination support
   * Simulates Zoom API behavior with 300 records per page
   */
  async getMeetingParticipantList(
    token: string,
    userArray: any[],
    zoomId: string,
    meetingType: MeetingType,
    url: string = '',
    pageSize: number = 300,
  ): Promise<ZoomParticipantResponseDto> {
    // Parse next_page_token from URL
    let currentPage = 1;
    const tokenMatch = url.match(/next_page_token=([^&]+)/);
    if (tokenMatch) {
      currentPage = this.parsePageToken(tokenMatch[1]);
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageParticipants = this.participantsData.slice(startIndex, endIndex);

    const totalRecords = this.participantsData.length;
    const totalPages = Math.ceil(totalRecords / pageSize);
    const nextPageToken = this.generatePageToken(currentPage);

    this.logger.log(
      `Mock API: Returning page ${currentPage}/${totalPages} with ${pageParticipants.length} participants (total: ${totalRecords})`,
    );

    return {
      participants: pageParticipants,
      next_page_token: nextPageToken || undefined,
      page_count: currentPage,
      page_size: pageSize,
      total_records: totalRecords,
    };
  }

  /**
   * Get meeting participants identifiers
   */
  async getMeetingParticipantsIdentifiers(
    meetingId: string,
    markAttendanceBy: string,
    meetingType: MeetingType,
    pageSize: number = 300,
  ): Promise<ParticipantListResponseDto> {
    const token = await this.getToken();
    const response = await this.getMeetingParticipantList(
      token,
      [],
      meetingId,
      meetingType,
      '',
      pageSize,
    );

    const inMeetingUserDetails = response.participants.filter(
      (user) => user.status === 'in_meeting',
    );

    if (markAttendanceBy === 'email' || markAttendanceBy === 'username') {
      const key = markAttendanceBy === 'email' ? 'user_email' : 'name';
      const identifiers = inMeetingUserDetails
        .filter((user) => user[key])
        .map((user) => user[key]);

      if (!identifiers.length) {
        throw new BadRequestException(ERROR_MESSAGES.NO_PARTICIPANTS_FOUND);
      }

      return {
        identifiers,
        inMeetingUserDetails,
        next_page_token: response.next_page_token,
        page_count: response.page_count,
        page_size: response.page_size,
        total_records: response.total_records,
      };
    } else {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_MARK_ATTENDANCE_BY);
    }
  }

  getParticipantAttendance(
    userList: UserDetails[],
    meetingParticipantDetails: InZoomMeetingUserDetails[],
    markAttendanceBy: string,
  ): AttendanceRecord[] {
    const userDetailList = [];
    let userMap: Map<string, UserDetails> = new Map();

    if (markAttendanceBy === 'email') {
      userMap = new Map(
        userList.map((user) => [user.email.toLowerCase(), user]),
      );
    } else if (markAttendanceBy === 'username') {
      userMap = new Map(
        userList.map((user) => [user.username.toLowerCase(), user]),
      );
    } else {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_MARK_ATTENDANCE_BY);
    }

    const key = markAttendanceBy === 'email' ? 'user_email' : 'name';
    meetingParticipantDetails.forEach((participantDetail: any) => {
      const userDetailExists = userMap.get(
        participantDetail[key]?.toLowerCase(),
      );
      if (userDetailExists) {
        userDetailList.push({ ...userDetailExists, ...participantDetail });
      }
    });

    return userDetailList.map(
      ({ userId, duration, join_time, leave_time }) => ({
        userId,
        attendance: 'present',
        metaData: {
          duration,
          autoMarked: true,
          joinTime: join_time,
          leaveTime: leave_time,
        },
      }),
    );
  }

  async addRegistrantToMeeting(
    meetingId: string,
    registrantData: {
      email: string;
      first_name: string;
      last_name: string;
    },
    meetingType?: MeetingType,
  ): Promise<any> {
    return {
      registrant_id: `mock-reg-${Date.now()}`,
      id: meetingId,
      join_url: 'https://mock-zoom.us/j/mock-meeting',
    };
  }

  async removeRegistrantFromMeeting(
    meetingId: string,
    registrantId: string,
    meetingType?: MeetingType,
  ): Promise<any> {
    return { success: true };
  }

  async getRegistrants(
    meetingId: string,
    meetingType?: MeetingType,
    pageSize?: number,
    nextPageToken?: string,
  ): Promise<any> {
    return {
      registrants: [],
      page_count: 0,
      page_size: pageSize || 30,
      total_records: 0,
      next_page_token: null,
    };
  }

  async checkRegistrantByEmail(
    meetingId: string,
    email: string,
    meetingType?: MeetingType,
  ): Promise<any | null> {
    return null;
  }
}



