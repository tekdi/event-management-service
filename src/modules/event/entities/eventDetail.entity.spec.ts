import { EventDetail } from './eventDetail.entity';

describe('EventDetail - setMultiSessionFlag', () => {
  it('sets multiSession=true when cohortIds has more than one entry', () => {
    const entity = new EventDetail();
    entity.metadata = { cohortIds: ['cohort-1', 'cohort-2'] };

    entity.setMultiSessionFlag();

    expect((entity.metadata as any).multiSession).toBe(true);
  });

  it('sets multiSession=false when cohortIds has exactly one entry', () => {
    const entity = new EventDetail();
    entity.metadata = { cohortIds: ['cohort-1'] };

    entity.setMultiSessionFlag();

    expect((entity.metadata as any).multiSession).toBe(false);
  });

  it('sets multiSession=false when cohortIds is missing or empty', () => {
    const entityMissing = new EventDetail();
    entityMissing.metadata = { category: 'Foundation' };
    entityMissing.setMultiSessionFlag();
    expect((entityMissing.metadata as any).multiSession).toBe(false);

    const entityEmpty = new EventDetail();
    entityEmpty.metadata = { cohortIds: [] };
    entityEmpty.setMultiSessionFlag();
    expect((entityEmpty.metadata as any).multiSession).toBe(false);
  });

  it('ignores a client-supplied multiSession value and recomputes it', () => {
    const entity = new EventDetail();
    entity.metadata = { cohortIds: ['cohort-1', 'cohort-2'], multiSession: false };

    entity.setMultiSessionFlag();

    expect((entity.metadata as any).multiSession).toBe(true);
  });

  it('handles a completely missing metadata object without throwing', () => {
    const entity = new EventDetail();
    entity.metadata = undefined;

    expect(() => entity.setMultiSessionFlag()).not.toThrow();
    expect((entity.metadata as any).multiSession).toBe(false);
  });
});
