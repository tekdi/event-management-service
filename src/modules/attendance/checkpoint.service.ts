import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

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
 * Simplified checkpoint service for attendance processing
 * 
 * This service handles:
 * - Simple event processing checkpoints with minimal data
 * - File-based persistence for resumability
 * - Essential fields only: eventRepetitionId, eventId, meetingId, pagination info
 * 
 * Checkpoints are stored in a single JSON file to enable resumability
 * in case of API failures or service interruptions.
 */
@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);
  private readonly checkpointDir = path.join(process.cwd(), 'checkpoints');
  private readonly checkpointFile = path.join(this.checkpointDir, 'attendance_checkpoints.json');

  constructor() {
    this.ensureCheckpointDir();
  }

  /**
   * Ensures the checkpoint directory exists
   * Creates the directory if it doesn't exist
   */
  private async ensureCheckpointDir(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create checkpoint directory', error);
    }
  }

  // ==================== SIMPLIFIED CHECKPOINT METHODS ====================

  /**
   * Saves a simple checkpoint for an event
   * @param checkpoint - The checkpoint data to save
   * @throws Error if saving fails
   */
  async saveCheckpoint(checkpoint: SimpleCheckpoint): Promise<void> {
    try {
      const data = await this.loadAllCheckpoints();
      data.checkpoints[checkpoint.eventRepetitionId] = checkpoint;
      await this.saveAllCheckpoints(data);
    } catch (error) {
      this.logger.error(`Failed to save checkpoint for event ${checkpoint.eventRepetitionId}`, error);
      throw error;
    }
  }

  /**
   * Loads a checkpoint for a specific event
   * @param eventRepetitionId - The event repetition ID to load checkpoint for
   * @returns The checkpoint data or null if not found
   */
  async loadCheckpoint(eventRepetitionId: string): Promise<SimpleCheckpoint | null> {
    try {
      const data = await this.loadAllCheckpoints();
      return data.checkpoints[eventRepetitionId] || null;
    } catch (error) {
      this.logger.error(`Failed to load checkpoint for event ${eventRepetitionId}`, error);
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
    try {
      const data = await this.loadAllCheckpoints();
      delete data.checkpoints[eventRepetitionId];
      await this.saveAllCheckpoints(data);
    } catch (error) {
      this.logger.error(`Failed to delete checkpoint for event ${eventRepetitionId}`, error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Loads all checkpoint data from the checkpoint file
   * @returns Object containing all checkpoints
   */
  private async loadAllCheckpoints(): Promise<{
    checkpoints: Record<string, SimpleCheckpoint>;
  }> {
    try {
      const data = await fs.readFile(this.checkpointFile, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Handle migration from old format to new format
      if (parsed.processingCheckpoints) {
        // Convert old format to new format
        const checkpoints: Record<string, SimpleCheckpoint> = {};
        for (const [key, value] of Object.entries(parsed.processingCheckpoints)) {
          const oldCheckpoint = value as any;
          checkpoints[key] = {
            eventRepetitionId: oldCheckpoint.eventRepetitionId,
            eventId: oldCheckpoint.eventId || '',
            meetingId: oldCheckpoint.zoomId || '',
            nextPageToken: oldCheckpoint.nextPageToken,
            currentPage: oldCheckpoint.currentPage,
            totalParticipants: oldCheckpoint.totalParticipants,
            participantsProcessed: oldCheckpoint.participantsProcessed,
            createdAt: oldCheckpoint.createdAt ? new Date(oldCheckpoint.createdAt) : new Date(),
            updatedAt: oldCheckpoint.updatedAt ? new Date(oldCheckpoint.updatedAt) : new Date(),
          };
        }
        
        // Save in new format and return
        await this.saveAllCheckpoints({ checkpoints });
        return { checkpoints };
      }
      
      // Return as-is if already in new format
      return parsed;
    } catch (error) {
      // Return empty structure if file doesn't exist
      return {
        checkpoints: {},
      };
    }
  }

  /**
   * Saves all checkpoint data to the checkpoint file
   * @param data - Object containing all checkpoint data to save
   */
  private async saveAllCheckpoints(data: {
    checkpoints: Record<string, SimpleCheckpoint>;
  }): Promise<void> {
    await fs.writeFile(this.checkpointFile, JSON.stringify(data, null, 2));
  }

  /**
   * Clears all checkpoint data by deleting the checkpoint file
   * This is useful for cleanup or when starting fresh
   */
  async clearAllCheckpoints(): Promise<void> {
    try {
      await fs.unlink(this.checkpointFile);
    } catch (error) {
      // File might not exist, which is fine
      this.logger.warn('No checkpoint file to clear');
    }
  }
}