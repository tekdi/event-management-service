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
import { TimeZoneTransformer } from '../../../common/utils/transformer/date.transformer';
import { ConfigService } from '@nestjs/config';

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

  @Column({
    type: 'timestamptz',
    default: () => "timezone('utc', now())",
    nullable: true,
    transformer: new TimeZoneTransformer(new ConfigService()),
  })
  startDateTime: Date;

  @Column({
    type: 'timestamptz',
    default: () => "timezone('utc', now())",
    nullable: true,
    transformer: new TimeZoneTransformer(new ConfigService()),
  })
  endDateTime: Date;

  // @ManyToOne(() => Events, (event) => event.eventRepetitions, {
  //   onDelete: 'CASCADE',
  //   onUpdate: 'CASCADE',
  // })
  // @JoinColumn({ name: 'eventId' })
  // event: Event;

  // @ManyToOne(() => EventDetail, (eventDetail) => eventDetail.eventRepetitions, {
  //   onDelete: 'CASCADE',
  //   onUpdate: 'CASCADE',
  // })
  // @JoinColumn({ name: 'eventDetailId' })
  // eventDetail: EventDetail;
}
