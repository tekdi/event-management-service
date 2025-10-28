import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventRepetition } from '../event/entities/eventRepetition.entity';

/**
 * Simplified checkpoint interface for event processing
 * Contains only essential fields for resumability
 */
export interface SimpleCheckpoint {
  eventRepetitionId: string;
  eventId: string;
  meetingId: string;
  nextPageToken: string | null;
  currentPage: number;
  totalParticipants: number;
  participantsProcessed: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for checkpoint data stored in database
 */
interface DatabaseCheckpoint {
  eventId: string;
  meetingId: string;
  nextPageToken: string | null;
  currentPage: number;
  totalParticipants: number;
  participantsProcessed: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface for params structure
 */
interface EventRepetitionParams {
  checkpoint?: DatabaseCheckpoint;
  [key: string]: any;
}

/**
 * Database-based checkpoint service for attendance processing
 * 
 * This service handles:
 * - Simple event processing checkpoints with minimal data
 * - Database-based persistence using EventRepetition.params column
 * - Essential fields only: eventRepetitionId, eventId, meetingId, pagination info
 * 
 * Checkpoints are stored in the EventRepetition.params JSONB column to enable:
 * - Better concurrency handling
 * - ACID compliance
 * - Integration with database backup systems
 * - Scalability across multiple service instances
 */
@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);

  constructor(
    @InjectRepository(EventRepetition)
    private readonly eventRepetitionRepository: Repository<EventRepetition>,
  ) {}

  // ==================== SIMPLIFIED CHECKPOINT METHODS ====================

  /**
   * Saves a simple checkpoint for an event
   * @param checkpoint - The checkpoint data to save
   * @throws Error if saving fails
   */
  async saveCheckpoint(checkpoint: SimpleCheckpoint): Promise<void> {
    await this.saveCheckpointToDatabase(checkpoint);
  }

  /**
   * Saves checkpoint to database using params column
   * @param checkpoint - The checkpoint data to save
   */
  private async saveCheckpointToDatabase(checkpoint: SimpleCheckpoint): Promise<void> {
    try {
      // Get existing params to preserve other parameters
      const existingEventRep = await this.eventRepetitionRepository.findOne({
        where: { eventRepetitionId: checkpoint.eventRepetitionId },
        select: ['params']
      });

      const existingParams = (existingEventRep?.params as EventRepetitionParams) || {};
      
      // Update with checkpoint data
      const updatedParams: EventRepetitionParams = {
        ...existingParams,
        checkpoint: {
          eventId: checkpoint.eventId,
          meetingId: checkpoint.meetingId,
          nextPageToken: checkpoint.nextPageToken,
          currentPage: checkpoint.currentPage,
          totalParticipants: checkpoint.totalParticipants,
          participantsProcessed: checkpoint.participantsProcessed,
          createdAt: checkpoint.createdAt.toISOString(),
          updatedAt: checkpoint.updatedAt.toISOString(),
        }
      };

      await this.eventRepetitionRepository.update(
        { eventRepetitionId: checkpoint.eventRepetitionId },
        { params: updatedParams }
      );

      this.logger.log(`Checkpoint saved to database for event ${checkpoint.eventRepetitionId}`);
    } catch (error) {
      this.logger.error(`Failed to save checkpoint to database for event ${checkpoint.eventRepetitionId}`, error);
      throw error;
    }
  }


  /**
   * Loads a checkpoint for a specific event
   * @param eventRepetitionId - The event repetition ID to load checkpoint for
   * @returns The checkpoint data or null if not found
   */
  async loadCheckpoint(eventRepetitionId: string): Promise<SimpleCheckpoint | null> {
    return await this.loadCheckpointFromDatabase(eventRepetitionId);
  }

  /**
   * Loads checkpoint from database using params column
   * @param eventRepetitionId - The event repetition ID to load checkpoint for
   * @returns The checkpoint data or null if not found
   */
  private async loadCheckpointFromDatabase(eventRepetitionId: string): Promise<SimpleCheckpoint | null> {
    try {
      const eventRep = await this.eventRepetitionRepository.findOne({
        where: { eventRepetitionId },
        select: ['eventRepetitionId', 'params']
      });

      if (!(eventRep?.params as EventRepetitionParams)?.checkpoint) {
        return null;
      }

      const checkpoint = (eventRep.params as EventRepetitionParams).checkpoint!;
      return {
        eventRepetitionId,
        eventId: checkpoint.eventId,
        meetingId: checkpoint.meetingId,
        nextPageToken: checkpoint.nextPageToken,
        currentPage: checkpoint.currentPage,
        totalParticipants: checkpoint.totalParticipants,
        participantsProcessed: checkpoint.participantsProcessed,
        createdAt: new Date(checkpoint.createdAt),
        updatedAt: new Date(checkpoint.updatedAt),
      };
    } catch (error) {
      this.logger.error(`Failed to load checkpoint from database for event ${eventRepetitionId}`, error);
      return null;
    }
  }


  /**
   * Creates a new simple checkpoint for an event
   * @param eventRepetitionId - The event repetition ID
   * @param eventId - The event ID
   * @param meetingId - The meeting/zoom ID
   * @returns The newly created checkpoint
   */
  async createCheckpoint(
    eventRepetitionId: string, 
    eventId: string, 
    meetingId: string
  ): Promise<SimpleCheckpoint> {
    const checkpoint: SimpleCheckpoint = {
      eventRepetitionId,
      eventId,
      meetingId,
      nextPageToken: null,
      currentPage: 0,
      totalParticipants: 0,
      participantsProcessed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  /**
   * Updates an existing checkpoint
   * @param checkpoint - The checkpoint data to update
   */
  async updateCheckpoint(checkpoint: SimpleCheckpoint): Promise<void> {
    checkpoint.updatedAt = new Date();
    await this.saveCheckpoint(checkpoint);
  }

  /**
   * Deletes a checkpoint for a specific event
   * @param eventRepetitionId - The event repetition ID to delete checkpoint for
   * @throws Error if deletion fails
   */
  async deleteCheckpoint(eventRepetitionId: string): Promise<void> {
    await this.deleteCheckpointFromDatabase(eventRepetitionId);
  }

  /**
   * Deletes checkpoint from database by removing checkpoint from params
   * @param eventRepetitionId - The event repetition ID to delete checkpoint for
   */
  private async deleteCheckpointFromDatabase(eventRepetitionId: string): Promise<void> {
    try {
      const eventRep = await this.eventRepetitionRepository.findOne({
        where: { eventRepetitionId },
        select: ['params']
      });

      if ((eventRep?.params as EventRepetitionParams)?.checkpoint) {
        const { checkpoint, ...restParams } = eventRep.params as EventRepetitionParams;
        await this.eventRepetitionRepository.update(
          { eventRepetitionId },
          { params: restParams }
        );
        this.logger.log(`Checkpoint deleted from database for event ${eventRepetitionId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete checkpoint from database for event ${eventRepetitionId}`, error);
      throw error;
    }
  }


  // ==================== UTILITY METHODS ====================

  /**
   * Migrates existing file-based checkpoints to database storage
   * This method should be called once during the transition period
   */
  async migrateFileCheckpointsToDatabase(): Promise<void> {
    this.logger.log('File-based checkpoint migration is no longer supported. Please use database-only storage.');
    throw new Error('File-based checkpoint migration is no longer supported. Use database-only storage.');
  }

  /**
   * Gets all checkpoints from database (for debugging/monitoring purposes)
   */
  async getAllCheckpoints(): Promise<Record<string, SimpleCheckpoint>> {
    try {
      const eventReps = await this.eventRepetitionRepository.find({
        where: {},
        select: ['eventRepetitionId', 'params']
      });

      const checkpoints: Record<string, SimpleCheckpoint> = {};
      
      for (const eventRep of eventReps) {
        if ((eventRep.params as EventRepetitionParams)?.checkpoint) {
          const checkpoint = (eventRep.params as EventRepetitionParams).checkpoint!;
          checkpoints[eventRep.eventRepetitionId] = {
            eventRepetitionId: eventRep.eventRepetitionId,
            eventId: checkpoint.eventId,
            meetingId: checkpoint.meetingId,
            nextPageToken: checkpoint.nextPageToken,
            currentPage: checkpoint.currentPage,
            totalParticipants: checkpoint.totalParticipants,
            participantsProcessed: checkpoint.participantsProcessed,
            createdAt: new Date(checkpoint.createdAt),
            updatedAt: new Date(checkpoint.updatedAt),
          };
        }
      }

      return checkpoints;
    } catch (error) {
      this.logger.error('Failed to get all database checkpoints', error);
      throw error;
    }
  }
}