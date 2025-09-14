import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { EventDetail } from './eventDetail.entity';
import { EventRepetition } from './eventRepetition.entity';
import { EventAttendees } from '../../attendees/entity/attendees.entity';

@Entity('Events')
export class Events {
  @PrimaryGeneratedColumn('uuid')
  eventId: string;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  recurrenceEndDate: Date;

  @Column({ type: 'jsonb' })
  // recurrencePattern: object;
  recurrencePattern: any;

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

  @Column({ type: 'boolean', default: false })
  autoEnroll: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  registrationStartDate: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  registrationEndDate: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'uuid' })
  eventDetailId: string;

  @Column({ type: 'boolean', default: false })
  platformIntegration: boolean;

  @OneToOne(() => EventDetail, (eventDetail) => eventDetail.events, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'eventDetailId' })
  eventDetail: EventDetail;

  @OneToMany(() => EventRepetition, (eventRepetition) => eventRepetition.event)
  eventRepetitions: EventRepetition[];

  @OneToMany(() => EventAttendees, (eventAttendees) => eventAttendees.event)
  eventAttendees: EventAttendees[];
}
