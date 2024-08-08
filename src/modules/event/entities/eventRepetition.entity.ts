import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Events } from './event.entity';
import { EventDetail } from './eventDetail.entity';

@Entity('EventRepetition')
export class EventRepetition {
  @PrimaryGeneratedColumn('uuid')
  eventRepetitionId: string;

  @Column({ type: 'uuid', nullable: true })
  eventId: string;

  @Column({ type: 'uuid', nullable: true })
  eventDetailId: string;

  @Column({ type: 'jsonb', nullable: true })
  onlineDetails: object;

  @Column({ type: 'jsonb', nullable: true })
  erMetaData: object;

  @Column({
    type: 'timestamptz',
    default: () => "timezone('utc', now())",
    nullable: true,
  })
  startDateTime: Date;

  @Column({
    type: 'timestamptz',
    default: () => "timezone('utc', now())",
    nullable: true,
  })
  endDateTime: Date;

  @Column({
    type: 'timestamptz',
    default: () => "timezone('utc', now())",
    nullable: true,
  })
  createdAt: Date;

  @Column({
    type: 'timestamptz',
    default: () => "timezone('utc', now())",
    nullable: true,
  })
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @ManyToOne(() => Events, (event) => event.eventRepetitions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'eventId' })
  event: Events;

  @ManyToOne(() => EventDetail, (eventDetail) => eventDetail.eventRepetitions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'eventDetailId' })
  eventDetail: EventDetail;
}
