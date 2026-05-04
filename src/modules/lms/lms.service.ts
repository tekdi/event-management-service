import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LmsService {
  private readonly logger = new Logger(LmsService.name);
  private readonly lmsServiceUrl: string;
  private readonly tenantId: string;
  private readonly organisationId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.lmsServiceUrl = this.configService.get('LMS_SERVICE_URL');
    this.tenantId = this.configService.get('TENANT_ID');
    this.organisationId = this.configService.get('ORGANISATION_ID');
  }

  /**
   * Mark lesson completion in LMS Service
   * @param eventId - The event ID that maps to lesson.media.source
   * @param userId - The user ID
   * @param timeSpent - Time spent in seconds
   * @returns Promise resolving to LMS service response
   */
  async markLessonCompletion(
    eventId: string,
    userId: string,
    timeSpent: number,
  ): Promise<any> {
    try {
      if (!this.lmsServiceUrl) {
        this.logger.warn(
          'LMS_SERVICE_URL not configured, skipping lesson completion call',
        );
        return null;
      }

      const response = await this.httpService.axiosRef.patch(
        `${this.lmsServiceUrl}/v1/tracking/event/${eventId}`,
        {
          userId,
          status: 'completed',
          timeSpent: Math.floor(timeSpent),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            tenantid: this.tenantId,
            organisationid: this.organisationId,
          },
        },
      );

      this.logger.log(
        `Successfully marked lesson completion for user ${userId} in event ${eventId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to call LMS service for event ${eventId}, user ${userId}`,
        {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data,
        },
      );
      throw error;
    }
  }

  /**
   * Create a lesson tracking attempt in LMS Service
   * @param lessonId - The lesson ID
   * @param userId - The user ID
   * @returns Promise resolving to LMS service response
   */
  async markLessonAttempt(lessonId: string, userId: string): Promise<any> {
    try {
      if (!this.lmsServiceUrl) {
        this.logger.warn(
          'LMS_SERVICE_URL not configured, skipping lesson attempt call',
        );
        return null;
      }

      const response = await this.httpService.axiosRef.post(
        `${this.lmsServiceUrl}/v1/tracking/lesson/attempt/${lessonId}?userId=${userId}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            tenantid: this.tenantId,
            organisationid: this.organisationId,
          },
        },
      );

      this.logger.log(
        `Successfully created lesson attempt for user ${userId} in lesson ${lessonId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to call LMS lesson attempt API for lesson ${lessonId}, user ${userId}`,
        {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data,
        },
      );
      throw error;
    }
  }

  /**
   * Mark lesson as completed with automatic retry if tracking not found
   * @param eventId - The event ID
   * @param userId - The user ID
   * @param timeSpent - Time spent in seconds
   */
  async markLessonCompletionWithRetry(
    eventId: string,
    userId: string,
    timeSpent: number,
  ): Promise<any> {
    try {
      return await this.markLessonCompletion(eventId, userId, timeSpent);
    } catch (error) {
      const errorStatus = error.response?.status;
      const errorData = error.response?.data;
      const errorMessage =
        errorData?.params?.errmsg || errorData?.message || error.message;

      if (
        errorStatus === 404 &&
        (errorMessage.includes('Tracking not found') ||
          errorMessage.includes('TRACKING_NOT_FOUND') ||
          errorMessage.includes('Lesson track'))
      ) {
        this.logger.log(
          `Lesson track not found for eventId ${eventId}, userId ${userId}. Attempting to create lesson track entry...`,
        );

        try {
          const lessonId = await this.getLessonIdFromEventId(eventId);
          if (!lessonId) return null;

          await this.markLessonAttempt(lessonId, userId);
          return await this.markLessonCompletion(eventId, userId, timeSpent);
        } catch (createError) {
          this.logger.error(
            `Failed to create lesson track entry for eventId ${eventId}, userId ${userId}`,
            { error: createError.message },
          );
          return null;
        }
      }
      throw error;
    }
  }

  /**
   * Get lessonId from eventId
   * @param eventId - The event ID
   */
  async getLessonIdFromEventId(eventId: string): Promise<string | null> {
    try {
      if (!this.lmsServiceUrl) return null;

      // Step 1: Get media by source (eventId)
      const mediaResponse = await this.httpService.axiosRef.get(
        `${this.lmsServiceUrl}/v1/media`,
        {
          params: { source: eventId, status: 'published' },
          headers: {
            tenantid: this.tenantId,
            organisationid: this.organisationId,
          },
        },
      );

      let mediaList = mediaResponse.data?.result || [];
      if (mediaList.media && Array.isArray(mediaList.media)) {
        mediaList = mediaList.media;
      }
      mediaList = this.flattenArray(Array.isArray(mediaList) ? mediaList : [mediaList]);

      const media = mediaList.find((m: any) => m.source === eventId);
      if (!media) return null;

      const mediaId = media.mediaId || media.media_id || media.id;
      if (!mediaId) return null;

      // Step 2: Get lesson by mediaId
      const lessonsResponse = await this.httpService.axiosRef.get(
        `${this.lmsServiceUrl}/v1/lessons`,
        {
          params: { status: 'published', limit: 1000 },
          headers: {
            tenantid: this.tenantId,
            organisationid: this.organisationId,
          },
        },
      );

      let lessons = lessonsResponse.data?.result?.lessons || lessonsResponse.data?.result || [];
      lessons = this.flattenArray(Array.isArray(lessons) ? lessons : [lessons]);

      const lesson = lessons.find(
        (l: any) =>
          l.mediaId === mediaId ||
          l.media_id === mediaId ||
          (l.media && (l.media.mediaId === mediaId || l.media.media_id === mediaId)),
      );

      if (!lesson) return null;
      return lesson.lessonId || lesson.lesson_id || lesson.id;
    } catch (error) {
      this.logger.error(`Error getting lessonId from eventId ${eventId}`, {
        error: error.message,
      });
      return null;
    }
  }

  private flattenArray(arr: any[]): any[] {
    const result: any[] = [];
    for (const item of arr) {
      if (Array.isArray(item)) {
        result.push(...this.flattenArray(item));
      } else if (item && typeof item === 'object') {
        result.push(item);
      }
    }
    return result;
  }
}
