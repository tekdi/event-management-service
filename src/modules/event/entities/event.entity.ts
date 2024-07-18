import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { EventDetail } from './eventDetail.entity';
import { EventRepetition } from './eventRepetition.entity';
import { TimeZoneTransformer } from '../../../common/utils/transformer/date.transformer';
import { ConfigService } from '@nestjs/config';
@Entity('Events')
export class Events {
  @PrimaryGeneratedColumn('uuid')
  eventId: string;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({
    type: 'timestamptz',
    transformer: new TimeZoneTransformer(new ConfigService()),
  })
  recurrenceEndDate: Date;

  @Column({ type: 'jsonb' })
  recurrencePattern: object;

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

  @Column({ type: 'boolean', default: false })
  autoEnroll: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
    transformer: new TimeZoneTransformer(new ConfigService()),
  })
  registrationStartDate: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
    transformer: new TimeZoneTransformer(new ConfigService()),
  })
  registrationEndDate: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'uuid' })
  eventDetailId: string;

  @OneToOne(() => EventDetail, (eventDetail) => eventDetail.events, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'eventDetailId' })
  eventDetail: EventDetail;

  @OneToMany(() => EventRepetition, (eventRepetition) => eventRepetition.event)
  eventRepetitions: EventRepetition[];
}
