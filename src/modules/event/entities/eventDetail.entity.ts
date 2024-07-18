import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Events } from './event.entity';
import { EventRepetition } from './eventRepetition.entity';
import { TimeZoneTransformer } from '../../../common/utils/transformer/date.transformer';
import { ConfigService } from '@nestjs/config';

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
    transformer: new TimeZoneTransformer(new ConfigService()),
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    transformer: new TimeZoneTransformer(new ConfigService()),
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

  @OneToOne(() => Events, (event) => event.eventDetail)
  events: Event[];

  @OneToMany(
    () => EventRepetition,
    (eventRepetition) => eventRepetition.eventDetail,
  )
  eventRepetitions: EventRepetition[];
}
