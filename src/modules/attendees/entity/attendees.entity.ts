import { ConfigService } from '@nestjs/config';
import { TimeZoneTransformer } from 'src/common/utils/transformer/date.transformer';
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

  @Column({ type: 'uuid', nullable: true })
  eventRepetitionId: string;

  @Column({ type: 'int', nullable: false, default: 0 })
  duration: number;

  @Column({ type: 'varchar', nullable: true, collation: 'pg_catalog.default' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true, 
    transformer: new TimeZoneTransformer(new ConfigService())
   })
  enrolledAt: Date;

  @Column({ type: 'uuid', nullable: true })
  enrolledBy: string;

  @UpdateDateColumn({ type: 'timestamptz', transformer: new TimeZoneTransformer(new ConfigService()) })
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn({ type: 'timestamptz',  transformer: new TimeZoneTransformer(new ConfigService()) })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ nullable: true, default: null })
  isAttended: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  joinedLeftHistory: any;

  // @ManyToOne(() => Events, event => event.eventAttendees)
  // @JoinColumn({ name: 'eventId' })
  // event: Events;

  // @ManyToOne(() => Users, user => user.eventAttendees)
  // @JoinColumn({ name: 'userId' })
  // user: Users;
}
