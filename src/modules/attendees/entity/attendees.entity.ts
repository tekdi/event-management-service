import { Events } from 'src/modules/event/entities/event.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('EventAttendees')
export class EventAttendees {
  @PrimaryGeneratedColumn('uuid')
  eventAttendeesId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  eventId: string;

  @Column({ type: 'uuid', nullable: true })
  eventRepetitionId: string;

  @Column({ nullable: true, default: null })
  isAttended: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  joinedLeftHistory: any;

  @Column({ type: 'int', nullable: false, default: 0 })
  duration: number;

  @Column({ type: 'varchar', nullable: true })
  status: string;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  enrolledAt: Date;

  @Column({ type: 'uuid', nullable: true })
  enrolledBy: string;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  registrantId: string;

  @ManyToOne(() => Events, event => event.eventAttendees)
  @JoinColumn({ name: 'eventId' })
  event: Events;

  // @ManyToOne(() => Users, user => user.eventAttendees)
  // @JoinColumn({ name: 'userId' })
  // user: Users;
}
