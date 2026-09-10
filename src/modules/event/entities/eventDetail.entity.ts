import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Events } from './event.entity';
import { EventRepetition } from './eventRepetition.entity';

@Entity('EventDetails')
export class EventDetail {
  @PrimaryGeneratedColumn('uuid')
  eventDetailId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  shortDescription: string;

  @Column({ type: 'varchar', length: 255 })
  eventType: string;

  @Column({ type: 'boolean', default: false })
  isRestricted: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'double precision', nullable: true })
  longitude: number;

  @Column({ type: 'double precision', nullable: true })
  latitude: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  onlineProvider: string;

  @Column({ type: 'int', default: 0 })
  maxAttendees: number;

  @Column({ type: 'jsonb' })
  recordings: object;

  @Column({ type: 'varchar', length: 255 })
  status: string;

  @Column({ type: 'text' })
  description: string;

  @Column('text', { array: true })
  attendees: string[];

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  meetingDetails: object;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'int', nullable: true })
  idealTime: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object;

  // Server-computed, not client-settable: recalculated from metadata.cohortIds on every
  // insert/update so it always reflects reality regardless of which code path saved this
  // row (create, or any of the recurring/non-recurring update branches).
  @BeforeInsert()
  @BeforeUpdate()
  setMultiSessionFlag() {
    const metadata: any = this.metadata ?? {};
    metadata.multiSession =
      Array.isArray(metadata.cohortIds) && metadata.cohortIds.length > 1;
    this.metadata = metadata;
  }

  @OneToOne(() => Events, (event) => event.eventDetail)
  events: Event[];

  @OneToMany(
    () => EventRepetition,
    (eventRepetition) => eventRepetition.eventDetail,
  )
  eventRepetitions: EventRepetition[];
}
