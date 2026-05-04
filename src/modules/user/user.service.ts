import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly userServiceUrl: string;
  private readonly batchSize: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.userServiceUrl = this.configService.get('USER_SERVICE');
    this.batchSize = this.configService.get<number>('BULK_IMPORT_BATCH_SIZE', 100);
  }

  /**
   * Resolve userIds from a list of emails
   * @param emails - Array of email strings
   * @returns Map of email to userId
   */
  async getUserIdsFromEmails(emails: string[]): Promise<Map<string, string>> {
    const emailToUserIdMap = new Map<string, string>();
    if (!emails || emails.length === 0) return emailToUserIdMap;

    try {
      if (!this.userServiceUrl) {
        this.logger.error('USER_SERVICE URL not configured');
        return emailToUserIdMap;
      }

      for (let i = 0; i < emails.length; i += this.batchSize) {
        const batch = emails.slice(i, i + this.batchSize);
        
        const response = await this.httpService.axiosRef.post(
          `${this.userServiceUrl}/user/v1/list`,
          {
            limit: batch.length,
            offset: 0,
            filters: {
              email: batch,
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        const users = response.data?.result?.getUserDetails || response.data?.result || [];
        for (const user of users) {
          if (user.email && user.userId) {
            emailToUserIdMap.set(user.email.toLowerCase(), user.userId);
          }
        }
      }

      return emailToUserIdMap;
    } catch (error) {
      this.logger.error('Failed to lookup users by email', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return emailToUserIdMap;
    }
  }
}
