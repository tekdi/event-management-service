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
    this.batchSize = this.configService.get<number>(
      'BULK_IMPORT_BATCH_SIZE',
      100,
    );
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
        const payload = {
          limit: batch.length,
          offset: 0,
          filters: {
            email: batch,
          },
        };

        const url = `${this.userServiceUrl}/user/v1/list`;

        const curl = `
curl --location --request POST '${url}' \
--header 'Content-Type: application/json' \
--data '${JSON.stringify(payload)}'
`;

        console.log(curl);

        const response = await this.httpService.axiosRef.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        // const response = await this.httpService.axiosRef.post(
        //   `${this.userServiceUrl}/user/v1/list`,
        //   {
        //     limit: batch.length,
        //     offset: 0,
        //     filters: {
        //       email: batch,
        //     },
        //   },
        //   {
        //     headers: {
        //       'Content-Type': 'application/json',
        //     },
        //   },
        // );
        // console.log('sdsdsd', response);

        const users =
          response.data?.result?.getUserDetails || response.data?.result || [];
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

  /**
   * Check if a user is shortlisted for a cohort
   * @param userId - The user ID
   * @param cohortId - The cohort ID
   * @returns Promise resolving to boolean
   */
  async checkCohortShortlisted(
    userId: string,
    cohortId: string,
  ): Promise<boolean> {
    try {
      if (!this.userServiceUrl) return false;

      const url = `${this.userServiceUrl}/user/v1/cohortmember/list`;
      const body = {
        limit: 1,
        offset: 0,
        filters: {
          userId,
          cohortId: [cohortId],
          status: ['shortlisted'],
        },
      };
      const headers = {
        'Content-Type': 'application/json',
        tenantid: this.configService.get('TENANT_ID'),
        academicyearid: this.configService.get('ACADEMIC_YEAR_ID'),
      };

      const response = await this.httpService.axiosRef.post(url, body, {
        headers,
      });

      const result = response.data?.result;

      const members =
        result?.results ||
        result?.userDetails ||
        result?.getUserDetails ||
        (Array.isArray(result) ? result : []);
      return members.length > 0;
    } catch (error) {
      this.logger.error('Failed to check cohort shortlisting status', {
        error: error.message,
        userId,
        cohortId,
      });
      return false;
    }
  }
}
