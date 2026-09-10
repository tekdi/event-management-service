import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventService } from './event.service';
import { Events } from './entities/event.entity';
import { EventDetail } from './entities/eventDetail.entity';
import { EventRepetition } from './entities/eventRepetition.entity';
import { AttendeesService } from '../attendees/attendees.service';
import { KafkaService } from 'src/kafka/kafka.service';

describe('EventService', () => {
  let service: EventService;
  let eventDetailRepository: { save: jest.Mock };

  const cohortIdOne = '11111111-1111-4111-8111-111111111111';
  const cohortIdTwo = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    eventDetailRepository = {
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Events), useValue: {} },
        {
          provide: getRepositoryToken(EventDetail),
          useValue: eventDetailRepository,
        },
        { provide: getRepositoryToken(EventRepetition), useValue: {} },
        { provide: AttendeesService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: KafkaService, useValue: {} },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSearchQuery - cohortIds filter', () => {
    const baseQuery = 'SELECT 1';

    it('matches an event that has any of the requested cohorts, and falls back to the legacy singular cohortId key', async () => {
      const filters = { cohortIds: [cohortIdOne, cohortIdTwo] };

      const query = await service.createSearchQuery(filters, baseQuery);

      expect(query).toContain(
        `ed."metadata"->'cohortIds' ?| array['${cohortIdOne}','${cohortIdTwo}']`,
      );
      expect(query).toContain(
        `ed."metadata"->>'cohortId' = ANY(array['${cohortIdOne}','${cohortIdTwo}'])`,
      );
    });

    it('adds no cohort clause when cohortIds is absent or empty', async () => {
      const withoutFilter = await service.createSearchQuery({}, baseQuery);
      const withEmptyArray = await service.createSearchQuery(
        { cohortIds: [] },
        baseQuery,
      );

      expect(withoutFilter).not.toContain('cohortIds');
      expect(withoutFilter).not.toContain(`metadata"->>'cohortId'`);
      expect(withEmptyArray).not.toContain('cohortIds');
    });
  });

  describe('createEventDetailDB - attendees & metaData', () => {
    it('never persists attendees, even when the request includes them', async () => {
      const createEventDto: any = {
        title: 'Sample event',
        status: 'live',
        attendees: ['33333333-3333-4333-8333-333333333333'],
        metaData: { cohortIds: [cohortIdOne] },
      };

      await service.createEventDetailDB(createEventDto);

      expect(eventDetailRepository.save).toHaveBeenCalledTimes(1);
      const savedEntity = eventDetailRepository.save.mock.calls[0][0];
      expect(savedEntity.attendees).toBeNull();
    });

    it('persists metaData.cohortIds untouched', async () => {
      const createEventDto: any = {
        title: 'Sample event',
        status: 'live',
        metaData: { cohortIds: [cohortIdOne, cohortIdTwo] },
      };

      await service.createEventDetailDB(createEventDto);

      const savedEntity = eventDetailRepository.save.mock.calls[0][0];
      expect(savedEntity.metadata).toEqual({
        cohortIds: [cohortIdOne, cohortIdTwo],
      });
    });
  });

  describe('restoreMergedMetadata', () => {
    it('merges updateBody.metadata into the pre-assign metadata instead of replacing it', () => {
      // Regression test: Object.assign(entity, updateBody, {...}) replaces entity.metadata
      // wholesale with updateBody.metadata. A partial update (e.g. just cohortIds) must not
      // wipe out unrelated existing metadata fields like category/courseType/teacherName.
      const entity: any = {
        metadata: { cohortIds: [cohortIdOne] }, // already clobbered by Object.assign
      };
      const metadataBeforeAssign = {
        category: 'Foundation',
        courseType: 'FC',
        cohortIds: [cohortIdOne],
      };
      const updateBody = { metadata: { cohortIds: [cohortIdOne, cohortIdTwo] } };

      (service as any).restoreMergedMetadata(
        entity,
        updateBody,
        metadataBeforeAssign,
      );

      expect(entity.metadata).toEqual({
        category: 'Foundation',
        courseType: 'FC',
        cohortIds: [cohortIdOne, cohortIdTwo],
      });
    });

    it('does nothing when the update did not touch metadata', () => {
      const entity: any = { metadata: { category: 'Foundation' } };
      const metadataBeforeAssign = { category: 'Foundation' };

      (service as any).restoreMergedMetadata(entity, {}, metadataBeforeAssign);

      expect(entity.metadata).toEqual({ category: 'Foundation' });
    });
  });
});
