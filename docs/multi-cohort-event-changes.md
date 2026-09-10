# Multi-Cohort Support for Events — Change Plan & Implementation

> **Status: Implemented.** Sections below now reflect what was actually shipped, not just the original plan. See §7 for the final open items (backfill script, index execution, coordinated deploy).

## Background

Today an event stores **one** cohort per event, as `metaData.cohortId` (a plain string) inside the untyped `EventDetails.metadata` jsonb column. We need to support **multiple cohorts per event**, i.e. `metaData.cohortIds: string[]`.

Scope of this change: **`event-management-service` only** — `create` and `list/search` APIs. Cohort membership resolution, roster fetching, and attendance validation are handled by other services/middleware and are explicitly out of scope here.

---

## 1. Changes in `event-management-service`

### 1.1 Create API (`POST /event/create`) — Implemented

- **Schema**: `metaData.cohortId: string` → `metaData.cohortIds: string[]`. `metaData` remains typed `any`/`@IsObject()` (`create-event.dto.ts`) — this is a passthrough field, so no DTO shape change was required to accept the array; only docs/examples were updated to show `cohortIds`.
- **Decision taken**: hard-cutover on write for new events (event-management-service does not dual-write `cohortId` alongside `cohortIds`); backward compatibility for **existing** rows is handled entirely on the read/query side (§1.2) plus the planned backfill (§3.1), not by continuing to write the old key.
- Updated Swagger/example payloads: `create-event-example.ts`, `update-event.dto.ts`, `update-event-example.ts`, `search-event-example.ts` — all now show `cohortIds` as an array.
- **`attendees` field on create** (§4): resolved — field kept on the DTO (now optional, no longer required for `isRestricted && autoEnroll`) so old/lagging frontend calls don't break validation, but the value is **never persisted**: `event.service.ts` `createEventDetailDB()` now always sets `eventDetail.attendees = null` regardless of what's sent.

### 1.2 List/Search API (`POST /event/list`) — Implemented

- **DTO**: `search-event.dto.ts` — `cohortId?: string` → `cohortIds?: string[]` (`@IsArray() @IsUUID('4', { each: true }) @IsOptional()`).
- **Query logic**: `event.service.ts` `createSearchQuery()` — the old scalar filter:
  ```sql
  ed."metadata"->>'cohortId'='${filters.cohortId}'
  ```
  is now a jsonb array-overlap check with a legacy fallback, matching an event if it has **any** of the requested cohort ids, under either key shape:
  ```sql
  (ed."metadata"->'cohortIds' ?| array['id1','id2'] OR ed."metadata"->>'cohortId' = ANY(array['id1','id2']))
  ```
  - **Backward compatibility decision (§3.1) taken: option (a) — dual-key check, kept permanently in the query** (not conditioned on the backfill running first), so search stays correct for old rows whether or not/whenever the backfill is run.
  - Values are validated as UUIDs by `FilterDto` (`@IsUUID('4', { each: true })`) before reaching this code, so they cannot contain SQL metacharacters — consistent with how `createdBy` and other UUID filters are already handled elsewhere in this same query builder. Note the query builder as a whole remains raw string-interpolated SQL throughout (pre-existing pattern, not introduced by this change); a full parameterization refactor of `createSearchQuery()` is a separate, larger effort outside this change's scope.

### 1.3 Performance — index query ready to run

No index exists today on `EventDetails.metadata` (no `@Index` decorators anywhere in `src`, no migration files in this repo — schema changes are applied outside this codebase). Run this directly against the database once convenient (ideally during a low-traffic window, `CONCURRENTLY` avoids locking the table for writes during index build):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eventdetails_metadata_gin
  ON "EventDetails" USING GIN (metadata jsonb_path_ops);
```

Note: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block — run it as a standalone statement (not wrapped in `BEGIN...COMMIT` by whatever client/tool executes it).

---

## 2. Downstream impact — `pratham-microservice` (cron jobs)

Three scheduled jobs in `src/modules/cronjobs/cronjobs.service.ts` consume events from `event-management-service`'s `/event/list` response and read `metadata.cohortId`. **All three will break** once the field is renamed/reshaped, independent of anything else:

| Job | Schedule | File:line | Issue |
|---|---|---|---|
| `sendNotificationForEvents` | daily 8AM | `cronjobs.service.ts:127,138` | No array handling at all. Reads `data?.metadata?.cohortId` as a scalar. Will resolve to `undefined` for every event → learner push notifications silently stop sending entirely (facilitator notifications unaffected, they key off `createdBy`). |
| `autoAttendancePart1` | daily midnight | `cronjobs.service.ts:626-628` | Has `Array.isArray` check but reads the **old key name** (`cohortId`) and takes only the first cohort via `.find(Boolean)` — drops absent-marking for all other cohorts on a multi-cohort event even after the rename. |
| `autoAttendancePart2` | daily 1AM | `cronjobs.service.ts:737-739` | Has `Array.isArray` check and already iterates all cohorts, but reads the **old key name**. After rename, evaluates to `[]` for every event → cohort attendance reconciliation stops working entirely. |

No `/event/create` calls exist in `pratham-microservice`, and no request filters use `cohortId`, so only the **response-parsing** side in these three jobs is affected.

**Fixes implemented in `pratham-microservice/src/modules/cronjobs/cronjobs.service.ts`:**
1. Added a shared helper `getEventCohortIds(event)` that reads `event.metadata.cohortIds` (new array), falling back to the legacy singular `event.metadata.cohortId` (string, or array if already present) for events that predate the migration/backfill.
2. `sendNotificationForEvents`: now extracts cohort ids via `flatMap(getEventCohortIds)` across all events (was a scalar `.map()`), and per-event device-id lookup now unions device IDs across **every** cohort tied to that event (was a single scalar lookup).
3. `autoAttendancePart1`: replaced `.find(Boolean)` (which silently used only the first cohort) with a loop over all of an event's cohort ids, aggregating deduplicated cohort members across all of them before computing absent users — so multi-cohort events get correct absent-marking across every cohort, not just one.
4. `autoAttendancePart2`: already looped per-cohort correctly; only the extraction was changed to use the new shared `getEventCohortIds()` helper (functionally equivalent to its prior inline logic, now consistent with the other two jobs and reading the new key).

This keeps the dual-key fallback logic **local to each consuming service** (`pratham-microservice` reads both shapes; `event-management-service`'s search query also checks both shapes per §1.2) rather than requiring `event-management-service` to keep writing the legacy `cohortId` key — so no coordinated same-instant deploy is required, though deploying both services reasonably close together is still recommended so the array-shaped data starts flowing to consumers promptly.

---

## 3. Migration plan

This change needs a migration on two fronts — data and rollout — since `cohortId` was never a validated field and multiple consumers read it directly.

### 3.1 Data migration (existing rows) — you are running this

Existing `EventDetails.metadata` rows only have `cohortId: "<single-id>"`. **Decision taken: backfill.** One-time update to add the array form to every existing row without touching the legacy key:
```sql
UPDATE "EventDetails"
SET metadata = metadata || jsonb_build_object('cohortIds', jsonb_build_array(metadata->>'cohortId'))
WHERE metadata ? 'cohortId' AND NOT metadata ? 'cohortIds';
```
Notes:
- Safe to run multiple times (idempotent — the `WHERE` clause skips rows that already have `cohortIds`).
- After this runs, every historical row has `cohortIds` in addition to the old `cohortId` key. **The legacy `cohortId` key is left in place, not removed** — the list-query dual-key check (§1.2) and the `pratham-microservice` fallback helper (§2) both tolerate its continued presence indefinitely, so there's no urgency to strip it in a follow-up migration; it's inert once `cohortIds` exists.
- Run this whenever convenient relative to deploying the code changes — the query-side dual-key check (§1.2) already works correctly against both old and new-shaped rows regardless of whether this backfill has run yet, so there's no strict ordering requirement between running this and deploying.

### 3.2 Rollout sequencing

Because both consuming code paths (event-management-service's search query, and `pratham-microservice`'s cron jobs) now tolerate **both** the old `cohortId` key and the new `cohortIds` key, there is no strict deploy-ordering requirement between the two services or the backfill — each piece degrades gracefully:
1. `event-management-service` create API can start writing `cohortIds` any time; old rows keep working via the dual-key query fallback (§1.2).
2. `pratham-microservice`'s cron jobs already read both shapes (§2) — deploy whenever convenient, no need to wait for the backfill.
3. Run the backfill (§3.1) whenever convenient — purely additive, non-breaking, idempotent.

Recommend deploying `event-management-service` and `pratham-microservice` reasonably close together in practice (so new multi-cohort events are correctly notified/attendance-tracked from day one), but it is not a hard same-instant requirement given the dual-key handling on both read paths.

### 3.3 Index migration
- Run the GIN index creation query directly against the database (§1.3) — no in-repo migration tooling exists for this service, so this is a manual DB operation rather than a tracked migration file.

---

## 4. Blocker — `attendees` field in create payload — Resolved (deferred)

`create-event.dto.ts` previously accepted a client-supplied `attendees: string[]` array directly in the create-event request (capped at 200 via `@ArrayMaxSize(200)`, **required** when `isRestricted && autoEnroll`). This was viable for a single cohort, but does not scale to multiple cohorts — with N cohorts per event the combined attendee list can easily exceed 200 and realistically could be in the thousands, and requiring the client to enumerate every attendee up front defeats the point of cohort-based enrollment (cohort membership is resolved by other services, not passed per-request).

**Decision taken (interim)**: don't redesign enrollment now — just stop storing the field.
- Frontend will be asked to stop sending `attendees` on create.
- The field remains on the DTO but is now fully optional (previously required `@IsDefined` for `isRestricted && autoEnroll` was removed) so any lagging frontend calls that still send it don't fail validation.
- Regardless of what's sent, `event.service.ts`'s `createEventDetailDB()` now always sets `eventDetail.attendees = null` — the value is accepted but never persisted.
- This is explicitly a stop-gap, not a redesign of enrollment. If/when cohort-roster-driven attendee resolution is built (out of scope here — see the earlier discussion on `cohortmember/list` roster-fetch), this field and its DTO validation should be revisited/removed entirely rather than left in this "accepted but ignored" state long-term.

---

## 5. Summary of concrete file changes

### `event-management-service` (this repo)

| File | Change |
|---|---|
| `src/modules/event/dto/create-event.dto.ts` | `metaData` example/docs updated to show `cohortIds`; `attendees` validation relaxed to fully optional (no longer required for `isRestricted && autoEnroll`) |
| `src/modules/event/dto/search-event.dto.ts` | `cohortId?: string` → `cohortIds?: string[]` with `@IsArray() @IsUUID('4', { each: true })` |
| `src/modules/event/event.service.ts` | `createSearchQuery()`: cohort filter rewritten to jsonb array-overlap (`?|`) with legacy `cohortId` key fallback; `createEventDetailDB()`: `attendees` is now always persisted as `null`, ignoring whatever the client sends; added `restoreMergedMetadata()` helper, called after all 7 `Object.assign(...)` sites in the update paths so partial metadata updates (e.g. `cohortIds` only) no longer wipe out unrelated metadata fields |
| `src/modules/event/entities/eventDetail.entity.ts` | Added `@BeforeInsert()/@BeforeUpdate()` hook `setMultiSessionFlag()` that recomputes `metadata.multiSession` from `metadata.cohortIds` on every save |
| `src/modules/event/dto/create-event-example.ts` | Example payloads updated to `cohortIds` array |
| `src/modules/event/dto/update-event.dto.ts` | Example payload updated to `cohortIds` array |
| `src/modules/event/dto/update-event-example.ts` | Example payloads updated to `cohortIds` array |
| `src/modules/event/dto/search-event-example.ts` | Example payloads updated to `cohortIds` array |
| DB (manual, no in-repo migration tooling) | Run the GIN index query from §1.3; run the backfill query from §3.1 |

### `pratham-microservice`

| File | Change |
|---|---|
| `src/modules/cronjobs/cronjobs.service.ts` | Added `getEventCohortIds()` helper (reads `cohortIds` array, falls back to legacy `cohortId`); `sendNotificationForEvents` now handles arrays and unions device IDs across all of an event's cohorts; `autoAttendancePart1` now aggregates cohort members across all cohorts instead of using only the first; `autoAttendancePart2` switched to the shared helper |

## 6a. `multiSession` flag — Implemented

Frontend needs a simple boolean to distinguish a single-cohort event from a multi-cohort one, rather than checking `cohortIds.length` themselves.

- **`metaData.multiSession: boolean`** — server-computed, not client-settable. `true` when `cohortIds` has more than one entry, `false` otherwise (including when `cohortIds` is missing/empty).
- Implemented as a TypeORM `@BeforeInsert()`/`@BeforeUpdate()` hook on `EventDetail` (`entities/eventDetail.entity.ts`) — it recomputes `multiSession` from `this.metadata.cohortIds` immediately before every insert/update, regardless of which service method is doing the saving. This guarantees consistency across create, all four update branches (recurring/non-recurring × main/specific), and any future save path, without needing to touch every call site individually.
- Any `multiSession` value sent by the client is silently overwritten — it is not trusted input.

## 6b. Edit / Delete for multi-cohort events — reviewed, one bug found & fixed

**No new endpoints were needed.** The existing `PATCH /event/:id` (eventRepetitionId) already covers both:
- **Edit**: send `{"metadata": {"cohortIds": [...]}}` in the update body to add/remove cohorts on an existing event. `multiSession` is automatically recalculated by the entity hook above.
- **Delete**: this service uses **soft-delete via archiving**, not a hard delete — `PATCH /event/:id` with `{"status": "archived"}`. There is no dedicated `DELETE` endpoint, and none was needed for multi-cohort support: archiving an event archives it regardless of how many cohorts are in `cohortIds`. Removing one cohort from a multi-cohort event without archiving the whole event is just an **edit** (update `cohortIds` to the new, shorter array), not a delete.

**Bug found while reviewing the edit path**: `event.service.ts`'s update logic uses a repeated pattern —
```ts
Object.assign(existingEventDetails, updateBody, { eventRepetitionId: ... });
```
across all update branches (`handleAllEventUpdate` → `updateEventDetailsForRecurringEvents`, and `handleSpecificRecurrenceUpdate`). This **replaces `existingEventDetails.metadata` wholesale with `updateBody.metadata`** rather than merging it — pre-existing behavior, not introduced by this change. In practice this meant: a client sending `{"metadata": {"cohortIds": [...]}}` to edit just the cohort list would **silently wipe out every other existing metadata field** (`category`, `courseType`, `teacherName`, `cycleId`, `tenantId`, `type`, etc.) — since only the fields in `updateBody.metadata` would survive.

This directly undermines the cohort-edit workflow this whole change is meant to support, so it's fixed as part of this work: added a `restoreMergedMetadata()` helper, called immediately after each of the 7 `Object.assign(...)` call sites that touch `.metadata`, which merges `updateBody.metadata` onto a snapshot of the metadata taken *before* the assign, instead of leaving the assign's wholesale replacement in place. Editing `cohortIds` (or any single metadata field) now correctly preserves the rest of the event's metadata. Covered by a new unit test (`restoreMergedMetadata` in `event.service.spec.ts`).

## 6. Decisions taken

1. **Backfill existing rows**, keeping the legacy `cohortId` key in place (not stripped) rather than removing it after backfill — §3.1.
2. **No coordinated same-instant deploy required** — both `event-management-service`'s search query and `pratham-microservice`'s cron jobs independently tolerate both the old and new key shapes, so deploy order and backfill timing are all decoupled — §3.2.
3. **GIN index**: since no migration tooling exists in this repo, the index is a manual DB operation — query provided in §1.3, to be run directly against the database.
4. **`attendees` field**: kept on the create DTO (now optional) but never persisted; frontend asked to stop sending it. Treated as an interim stop-gap, not a permanent design — flagged for revisit if/when roster-driven enrollment is built — §4.
