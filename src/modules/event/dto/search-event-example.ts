const searchEventsExamples: Record<
  string,
  { limit: number; offset: number; filters: any }
> = {
  // All keys are optional you just cant use startDate and endDate along with the date filter
  SearchWithStartAndEndDate: {
    limit: 100,
    offset: 2,
    filters: {
      startDate: {
        after: '2024-08-21T18:30:00Z',
        before: '2024-08-22T18:29:59Z',
      },
      endDate: {
        after: '2024-08-24T18:30:00Z',
        before: '2024-08-25T18:29:59Z',
      },
      status: ['live', 'draft', 'inActive', 'archived'],
      eventType: [
        //   "online"
        'offline',
      ],
      title: 'Event',
      cohortId: '0278fd6a-ed93-4f29-b961-d3c87697c76a',
      createdBy: 'eff008a8-2573-466d-b877-fddf6a4fc13e',
    },
  },
  SearchWithDateInBetweenRange: {
    limit: 100,
    offset: 1,
    filters: {
      date: {
        after: '2024-08-24T18:30:00Z',
        before: '2024-08-25T18:29:59Z',
      },
      status: ['live', 'draft', 'inActive', 'archived'],
      eventType: [
        //   "online"
        'offline',
      ],
      title: 'Event',
      cohortId: '0278fd6a-ed93-4f29-b961-d3c87697c76a',
      createdBy: 'eff008a8-2573-466d-b877-fddf6a4fc13e',
    },
  },
  SearchWithOtherFilters: {
    limit: 100,
    offset: 1,
    filters: {
      title: 'Event',
      cohortId: '0278fd6a-ed93-4f29-b961-d3c87697c76a',
    },
  },
};

export const searchEventsExamplesForSwagger = Object.entries(
  searchEventsExamples,
).reduce(
  (acc, [key, value]) => {
    acc[key] = {
      summary: `Example for ${key}`,
      description: `Detailed example for ${key}`,
      value, // Use the example value as-is
    };
    return acc;
  },
  {} as Record<string, { summary: string; description: string; value: any }>,
);
