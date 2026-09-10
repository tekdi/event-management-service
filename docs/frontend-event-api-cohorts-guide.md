# Event APIs — Multi-Cohort Support (Frontend Guide)

Events can now belong to **more than one cohort**. This changes what goes inside `metaData`/`metadata` on create, list, and edit. No new endpoints — the existing create, list, and update APIs cover everything, including "delete."

## What changed

- `metaData.cohortId` (single string) → **`metaData.cohortIds` (array of strings)**. Always send an array, even for a single cohort: `["<id>"]`.
- **`metaData.multiSession` is read-only** — the backend computes it automatically (`true` when `cohortIds` has more than 1 entry, `false` otherwise). Don't send it; if you do, it's ignored and overwritten. Use it to show a "multi-session" badge/indicator in the UI without counting `cohortIds` yourself.
- **`attendees` is no longer used.** Please stop sending it on create. If it's still sent, it will be accepted but silently ignored (not stored) — this is a temporary compatibility state, not something to rely on.
- The `filters.cohortId` search filter is now **`filters.cohortIds` (array)** — matches an event if it belongs to **any** of the cohort ids you pass.

## 1. Create an event

`POST /interface/v1/event/create`

```bash
curl 'https://qa-interface.prathamdigital.org/interface/v1/event/create' \
  -H 'academicyearid: f2692dd5-d2c9-43f3-9bbf-c38fb6d398f9' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -H 'tenantid: ef99949b-7f3a-4a5f-806a-e67e683e38f3' \
  --data-raw '{
    "title": "Recurring offline",
    "shortDescription": "",
    "description": "",
    "eventType": "offline",
    "isRestricted": true,
    "autoEnroll": true,
    "location": "andaman second batch",
    "maxAttendees": 40,
    "status": "live",
    "createdBy": "cd01dd08-aa99-4b39-82d3-b1d95498d4b0",
    "updatedBy": "cd01dd08-aa99-4b39-82d3-b1d95498d4b0",
    "idealTime": "120",
    "isRecurring": true,
    "startDatetime": "2026-09-10T18:30:00Z",
    "endDatetime": "2026-09-10T19:30:00Z",
    "registrationStartDate": "",
    "registrationEndDate": "",
    "metaData": {
      "category": "Recurring offline",
      "courseType": "Foundation Course",
      "subject": "Beyond Classroom",
      "teacherName": "Aditya",
      "cohortIds": ["3d3ddc57-d7b8-4950-aa69-c678622e1e61"],
      "cycleId": "",
      "tenantId": "",
      "type": "planned"
    },
    "recurrencePattern": {
      "frequency": "weekly",
      "interval": 1,
      "daysOfWeek": [1],
      "endCondition": { "type": "endDate", "value": "2026-09-11T19:30:00Z" },
      "recurringStartDate": "2026-09-10T18:30:00Z"
    }
  }'
```

**Multiple cohorts** — just list more than one id in `cohortIds`; nothing else about the payload changes:

```json
"metaData": {
  "category": "Recurring offline",
  "courseType": "Foundation Course",
  "subject": "Beyond Classroom",
  "teacherName": "Aditya",
  "cohortIds": [
    "3d3ddc57-d7b8-4950-aa69-c678622e1e61",
    "9c8a9d3e-6b3a-4b3a-9f3a-1a2b3c4d5e6f"
  ],
  "cycleId": "",
  "tenantId": "",
  "type": "planned"
}
```

The response's `metaData` will come back with `multiSession: true` automatically in this case (`false` for the single-cohort example above) — no need to compute it client-side.

## 2. List / search events

`POST /interface/v1/event/list`

```bash
curl 'https://qa-interface.prathamdigital.org/interface/v1/event/list' \
  -H 'academicyearid: f2692dd5-d2c9-43f3-9bbf-c38fb6d398f9' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -H 'tenantid: ef99949b-7f3a-4a5f-806a-e67e683e38f3' \
  --data-raw '{
    "limit": 0,
    "offset": 0,
    "filters": {
      "cohortIds": ["3d3ddc57-d7b8-4950-aa69-c678622e1e61"],
      "startDate": { "after": "2026-09-10T18:30:00Z" },
      "endDate": { "before": "2026-09-11T18:29:59Z" },
      "status": ["live"]
    }
  }'
```

To find events matching **any** of several cohorts, just pass more ids: `"cohortIds": ["id-1", "id-2"]`.

## 3. Edit an event (including adding/removing cohorts)

`PATCH /interface/v1/event/:eventRepetitionId`

To change which cohorts an event belongs to, send the **full new `cohortIds` array** (not a diff) inside `metadata`:

```bash
curl -X PATCH 'https://qa-interface.prathamdigital.org/interface/v1/event/<eventRepetitionId>' \
  -H 'academicyearid: f2692dd5-d2c9-43f3-9bbf-c38fb6d398f9' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -H 'tenantid: ef99949b-7f3a-4a5f-806a-e67e683e38f3' \
  --data-raw '{
    "updatedBy": "cd01dd08-aa99-4b39-82d3-b1d95498d4b0",
    "isMainEvent": true,
    "metadata": {
      "cohortIds": [
        "3d3ddc57-d7b8-4950-aa69-c678622e1e61",
        "9c8a9d3e-6b3a-4b3a-9f3a-1a2b3c4d5e6f"
      ]
    }
  }'
```

Notes:
- Only the fields you include in `metadata` are changed — other existing metadata fields (`category`, `courseType`, `teacherName`, etc.) are preserved, not wiped out.
- `multiSession` is recalculated automatically after this update — you don't need to (and can't) set it directly.
- `isMainEvent: true` updates all future occurrences of a recurring event; omit it (or set `false`) to update just this one occurrence — same as before, unrelated to the cohort change.

## 4. "Delete" an event

There's no separate delete endpoint — deletion is a soft-delete via the same edit endpoint, setting `status` to `"archived"`:

```bash
curl -X PATCH 'https://qa-interface.prathamdigital.org/interface/v1/event/<eventRepetitionId>' \
  -H 'academicyearid: f2692dd5-d2c9-43f3-9bbf-c38fb6d398f9' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -H 'tenantid: ef99949b-7f3a-4a5f-806a-e67e683e38f3' \
  --data-raw '{
    "updatedBy": "cd01dd08-aa99-4b39-82d3-b1d95498d4b0",
    "isMainEvent": true,
    "status": "archived"
  }'
```

This works the same regardless of how many cohorts are on the event — archiving removes the whole event, not one cohort at a time. To remove just one cohort from a multi-cohort event while keeping the event live for the rest, use the **edit** call above with a shorter `cohortIds` array instead of archiving.

## Quick reference

| Action | Method | Cohort field |
|---|---|---|
| Create | `POST /event/create` | `metaData.cohortIds: string[]` |
| List/search | `POST /event/list` | `filters.cohortIds: string[]` (matches any) |
| Edit (incl. change cohorts) | `PATCH /event/:eventRepetitionId` | `metadata.cohortIds: string[]` (send full new array) |
| Delete (archive) | `PATCH /event/:eventRepetitionId` | `{"status": "archived"}` — cohorts irrelevant |
| Multi-session indicator | *(read-only, in every response)* | `metaData.multiSession: boolean` |
