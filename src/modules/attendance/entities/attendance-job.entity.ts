import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AttendanceJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('attendance_jobs')
@Index(['eventRepetitionId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['status', 'createdAt'])
@Index(['eventRepetitionId', 'status'])
export class AttendanceJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, name: 'job_id' })
  jobId: string; // BullMQ job ID

  @Column({ type: 'uuid', nullable: true, name: 'event_repetition_id' })
  eventRepetitionId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: AttendanceJobStatus.PENDING,
    name: 'status',
  })
  status: AttendanceJobStatus;

  @Column({ type: 'int', default: 0, name: 'progress' })
  progress: number; // 0-100

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true, name: 'result' })
  result: any; // Processing statistics

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
