module.exports = {
  routes: [
    {
      sourceRoute: '/event-service/event/v1/create',
      type: 'POST',
      inSequence: true,
      orchestrated: true,
      targetRoute: {
        path: '/event-service/event/v1/create',
        type: 'POST',
        functionName: 'createEvent',
      },
    },
    {
      sourceRoute: '/event-service/event/v1/:id',
      type: 'PATCH',
      inSequence: true,
      orchestrated: true,
      targetRoute: {
        path: '/event-service/event/v1/:id',
        type: 'PATCH',
        functionName: 'updateEvent',
      },
    },
    {
      sourceRoute: '/event-service/event/v1/list',
      type: 'POST',
      inSequence: true,
      orchestrated: true,
      targetRoute: {
        path: '/event-service/event/v1/list',
        type: 'POST',
        functionName: 'listEvents',
      },
    },
  ],
};
