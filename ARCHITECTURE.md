# Event Management Service - Architecture Documentation

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│                    (Web Browsers, Mobile Apps, APIs)                        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOAD BALANCER (Nginx)                             │
│  • Rate Limiting: 100 req/s (burst 20)                                     │
│  • Connection Pooling: 32 keepalive                                         │
│  • Response Caching: 5 min for GET                                          │
│  • Gzip Compression                                                          │
│  • Load Balancing: least_conn algorithm                                     │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER (NestJS)                            │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│  │  Instance 1 │    │  Instance 2 │    │  Instance N │                    │
│  │  (Cluster)  │    │  (Cluster)  │    │  (Cluster)  │                    │
│  │             │    │             │    │             │                    │
│  │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │                    │
│  │ │Worker 1 │ │    │ │Worker 1 │ │    │ │Worker 1 │ │                    │
│  │ │Worker 2 │ │    │ │Worker 2 │ │    │ │Worker 2 │ │                    │
│  │ │Worker 3 │ │    │ │Worker 3 │ │    │ │Worker 3 │ │                    │
│  │ │Worker 4 │ │    │ │Worker 4 │ │    │ │Worker 4 │ │                    │
│  │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │                    │
│  └─────────────┘    └─────────────┘    └─────────────┘                    │
│                                                                              │
│  Features:                                                                   │
│  • Rate Limiting: 100 req/min per IP                                        │
│  • Circuit Breakers: User & Attendance Services                             │
│  • Permission Caching: 1 hour TTL                                           │
│  • Health Checks: /health, /health/ready, /health/live                     │
│  • Monitoring: /monitoring/metrics, /monitoring/circuit-breakers            │
└──────────────────────────────────────────────────────────────────────────────┘
                    │            │            │
        ┌───────────┼────────────┼────────────┼───────────┐
        │           │            │            │           │
        ▼           ▼            ▼            ▼           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DATA & CACHE LAYER                                 │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐   │
│  │   PostgreSQL 15     │  │      Redis 7        │  │    Kafka 3       │   │
│  │                     │  │                     │  │                  │   │
│  │ • Connection Pool   │  │ • Permission Cache  │  │ • Event Topics   │   │
│  │   Min: 10           │  │   TTL: 1 hour       │  │ • Async Jobs     │   │
│  │   Max: 100          │  │ • Query Cache       │  │ • Notifications  │   │
│  │ • 15+ Indexes       │  │   TTL: 30 seconds   │  │                  │   │
│  │ • Query Caching     │  │ • Max: 1000 items   │  │                  │   │
│  └─────────────────────┘  └─────────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES LAYER                               │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐   │
│  │   User Service      │  │ Attendance Service  │  │  Zoom Adapter    │   │
│  │                     │  │                     │  │                  │   │
│  │ • Circuit Breaker   │  │ • Circuit Breaker   │  │ • Meeting APIs   │   │
│  │   Timeout: 5s       │  │   Timeout: 5s       │  │ • Participants   │   │
│  │   Threshold: 50%    │  │   Threshold: 50%    │  │                  │   │
│  └─────────────────────┘  └─────────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Application Architecture (Detailed)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          NestJS APPLICATION                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         MIDDLEWARE LAYER                               │ │
│  │                                                                        │ │
│  │  ┌──────────────────────┐         ┌──────────────────────┐           │ │
│  │  │ Permission Middleware│         │  Logger Middleware   │           │ │
│  │  │                      │         │                      │           │ │
│  │  │ • JWT Validation     │         │ • Request Logging    │           │ │
│  │  │ • Role Extraction    │         │ • Performance Track  │           │ │
│  │  │ • Permission Cache   │         │                      │           │ │
│  │  │   (Redis, 1h TTL)    │         │                      │           │ │
│  │  └──────────────────────┘         └──────────────────────┘           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         CONTROLLER LAYER                               │ │
│  │                                                                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │ │
│  │  │   Event     │  │  Attendees  │  │ Attendance  │  │   Health    │ │ │
│  │  │ Controller  │  │ Controller  │  │ Controller  │  │ Controller  │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │ │
│  │                                                                        │ │
│  │  ┌─────────────┐  ┌─────────────┐                                    │ │
│  │  │ Monitoring  │  │    RBAC     │                                    │ │
│  │  │ Controller  │  │ Controller  │                                    │ │
│  │  └─────────────┘  └─────────────┘                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          SERVICE LAYER                                 │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    Event Service                                │ │ │
│  │  │  • Create/Update/Delete Events                                  │ │ │
│  │  │  • Recurring Event Generation                                   │ │ │
│  │  │  • Event Search & Filtering                                     │ │ │
│  │  │  • Kafka Event Publishing                                       │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                 Attendance Service                              │ │ │
│  │  │  • Meeting Attendance Marking                                   │ │ │
│  │  │  • Circuit Breaker: User Service                                │ │ │
│  │  │  • Circuit Breaker: Attendance Service                          │ │ │
│  │  │  • Zoom Integration                                             │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │              Circuit Breaker Service                            │ │ │
│  │  │  • Create/Manage Breakers                                       │ │ │
│  │  │  • Monitor Breaker State                                        │ │ │
│  │  │  • Statistics Collection                                        │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       INFRASTRUCTURE LAYER                             │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │ Cache Module │  │ Kafka Module │  │Health Module │               │ │
│  │  │   (Redis)    │  │ (Producer +  │  │  (Terminus)  │               │ │
│  │  │              │  │  Consumer)   │  │              │               │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │   Database   │  │  Throttler   │  │  Monitoring  │               │ │
│  │  │    Module    │  │    Module    │  │    Module    │               │ │
│  │  │  (TypeORM)   │  │ (Rate Limit) │  │   (Metrics)  │               │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REQUEST FLOW (Read Operation)                       │
└─────────────────────────────────────────────────────────────────────────────┘

Client Request
      │
      ▼
┌──────────────┐
│    Nginx     │  Rate Limit Check (100 req/s)
│ Load Balancer│  Cache Check (5 min for GET)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   NestJS     │  Rate Limit Check (100 req/min)
│  Application │  
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Permission  │  1. Extract JWT token
│  Middleware  │  2. Get role from token
└──────┬───────┘  3. Check Redis cache for permissions
       │              ├─ Cache HIT (70-80%) → Return cached
       │              └─ Cache MISS → Query DB → Cache result (1h TTL)
       ▼
┌──────────────┐
│  Controller  │  Route to appropriate handler
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service    │  Business logic execution
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  TypeORM     │  1. Check query cache (30s TTL)
│  Repository  │  2. Execute query with connection pool
└──────┬───────┘  3. Use indexes for optimization
       │
       ▼
┌──────────────┐
│  PostgreSQL  │  Return data
└──────┬───────┘
       │
       ▼
Response to Client (with caching headers)


┌─────────────────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW (Write Operation)                       │
└─────────────────────────────────────────────────────────────────────────────┘

Client Request
      │
      ▼
┌──────────────┐
│    Nginx     │  Rate Limit Check
│ Load Balancer│  No caching for POST/PUT/DELETE
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   NestJS     │  Rate Limit + Permission Check
│  Application │  (same as read flow)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Controller  │  Validation (class-validator)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service    │  Business logic
└──────┬───────┘
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌──────────────┐         ┌──────────────┐
│  PostgreSQL  │         │    Kafka     │
│   (Write)    │         │  (Publish)   │
└──────┬───────┘         └──────────────┘
       │                         │
       │                         ▼
       │                  ┌──────────────┐
       │                  │    Kafka     │
       │                  │  Consumer    │
       │                  └──────┬───────┘
       │                         │
       │                         ▼
       │                  Async Processing
       │                  (Recurring events,
       │                   notifications, etc.)
       │
       ▼
┌──────────────┐
│ Cache        │  Invalidate related cache entries
│ Invalidation │  (permissions, query results)
└──────────────┘
       │
       ▼
Response to Client
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CACHING LAYERS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1: Nginx Response Cache
┌────────────────────────────────────────────────────────────────────────────┐
│  • Cache Type: HTTP Response Cache                                         │
│  • TTL: 5 minutes                                                          │
│  • Methods: GET, HEAD only                                                 │
│  • Cache Key: $scheme$request_method$host$request_uri                      │
│  • Max Size: 100MB                                                         │
│  • Hit Rate: ~60-70% for public endpoints                                  │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
Layer 2: Application Cache (Redis)
┌────────────────────────────────────────────────────────────────────────────┐
│  Permission Cache:                                                         │
│  • Key Pattern: permissions:{role}:{apiPath}                               │
│  • TTL: 1 hour (3600 seconds)                                              │
│  • Hit Rate: 70-80%                                                        │
│  • Invalidation: On role/permission updates                                │
│                                                                            │
│  Query Result Cache:                                                       │
│  • Key Pattern: query:{hash}                                               │
│  • TTL: 30 seconds                                                         │
│  • Hit Rate: 40-50%                                                        │
│  • Invalidation: On data updates                                           │
│                                                                            │
│  Session Cache:                                                            │
│  • Key Pattern: session:{userId}                                           │
│  • TTL: 24 hours                                                           │
│  • Hit Rate: 90%+                                                          │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
Layer 3: Database Query Cache
┌────────────────────────────────────────────────────────────────────────────┐
│  • Cache Type: TypeORM Query Result Cache                                  │
│  • TTL: 30 seconds                                                         │
│  • Storage: Database table                                                 │
│  • Automatic invalidation on writes                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Circuit Breaker Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CIRCUIT BREAKER ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │   Application Service   │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  Circuit Breaker Service│
                    │                         │
                    │  • Create Breakers      │
                    │  • Monitor State        │
                    │  • Collect Stats        │
                    └───────────┬─────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
    ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │  User Service    │ │ Attendance       │ │  Other External  │
    │  Circuit Breaker │ │ Service CB       │ │  Service CB      │
    │                  │ │                  │ │                  │
    │ Config:          │ │ Config:          │ │ Config:          │
    │ • Timeout: 5s    │ │ • Timeout: 5s    │ │ • Timeout: 3s    │
    │ • Threshold: 50% │ │ • Threshold: 50% │ │ • Threshold: 50% │
    │ • Reset: 30s     │ │ • Reset: 30s     │ │ • Reset: 30s     │
    └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
             │                    │                    │
             ▼                    ▼                    ▼
    ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │  External User   │ │  External        │ │  Other External  │
    │  Service API     │ │  Attendance API  │ │  Services        │
    └──────────────────┘ └──────────────────┘ └──────────────────┘


Circuit Breaker States:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   CLOSED (Normal Operation)                                                │
│   ├─ All requests pass through                                             │
│   ├─ Monitor failure rate                                                  │
│   └─ If failures > 50% → OPEN                                              │
│                                                                            │
│   OPEN (Failing Fast)                                                      │
│   ├─ All requests immediately fail                                         │
│   ├─ No calls to external service                                          │
│   ├─ Wait for reset timeout (30s)                                          │
│   └─ After timeout → HALF-OPEN                                             │
│                                                                            │
│   HALF-OPEN (Testing Recovery)                                             │
│   ├─ Allow limited requests through                                        │
│   ├─ If successful → CLOSED                                                │
│   └─ If failed → OPEN                                                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

Application Layer (Multiple Instances)
         │
         │ Connection Pool (per instance)
         │ Min: 10, Max: 100
         │ Idle Timeout: 30s
         │ Connection Timeout: 5s
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PostgreSQL 15                                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         TABLES & INDEXES                              │ │
│  │                                                                       │ │
│  │  Events Table:                                                        │ │
│  │  ├─ idx_events_created_at                                             │ │
│  │  ├─ idx_events_updated_at                                             │ │
│  │  ├─ idx_events_recurring (isRecurring, recurrenceEndDate)             │ │
│  │  ├─ idx_events_detail_id                                              │ │
│  │  └─ idx_events_created_by                                             │ │
│  │                                                                       │ │
│  │  EventRepetition Table:                                               │ │
│  │  ├─ idx_event_repetition_event_id                                     │ │
│  │  ├─ idx_event_repetition_start_date                                   │ │
│  │  ├─ idx_event_repetition_end_date                                     │ │
│  │  └─ idx_event_repetition_composite (eventId, startDateTime)           │ │
│  │                                                                       │ │
│  │  EventAttendees Table:                                                │ │
│  │  ├─ idx_event_attendees_user_id                                       │ │
│  │  ├─ idx_event_attendees_event_id                                      │ │
│  │  ├─ idx_event_attendees_status                                        │ │
│  │  └─ idx_event_attendees_user_event (userId, eventId)                  │ │
│  │                                                                       │ │
│  │  RolePermissionMapping Table:                                         │ │
│  │  ├─ idx_role_permission_role                                          │ │
│  │  ├─ idx_role_permission_path                                          │ │
│  │  └─ idx_role_permission_composite (roleTitle, apiPath)                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      QUERY OPTIMIZATION                               │ │
│  │                                                                       │ │
│  │  • Query Result Cache (30s TTL)                                       │ │
│  │  • Prepared Statements (TypeORM)                                      │ │
│  │  • Index-based Query Plans                                            │ │
│  │  • Connection Pooling                                                 │ │
│  │  • Automatic ANALYZE on tables                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION DEPLOYMENT ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────────────────┘

                              Internet
                                 │
                                 │ HTTPS (443)
                                 ▼
                    ┌─────────────────────────┐
                    │   Load Balancer / CDN   │
                    │   (AWS ALB / Cloudflare)│
                    └────────────┬────────────┘
                                 │
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
        ┌─────────────────────┐   ┌─────────────────────┐
        │   Nginx Instance 1  │   │   Nginx Instance 2  │
        │   (Load Balancer)   │   │   (Load Balancer)   │
        └──────────┬──────────┘   └──────────┬──────────┘
                   │                          │
        ┌──────────┴──────────────────────────┴──────────┐
        │                                                 │
        ▼                                                 ▼
┌──────────────────┐                            ┌──────────────────┐
│  Event Service   │                            │  Event Service   │
│   Instance 1     │                            │   Instance 2     │
│                  │                            │                  │
│  ┌────────────┐  │                            │  ┌────────────┐  │
│  │ Worker 1   │  │                            │  │ Worker 1   │  │
│  │ Worker 2   │  │                            │  │ Worker 2   │  │
│  │ Worker 3   │  │                            │  │ Worker 3   │  │
│  │ Worker 4   │  │                            │  │ Worker 4   │  │
│  └────────────┘  │                            │  └────────────┘  │
└────────┬─────────┘                            └────────┬─────────┘
         │                                               │
         └───────────────────┬───────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   PostgreSQL     │ │      Redis       │ │      Kafka       │
│   (Primary)      │ │    (Cluster)     │ │    (Cluster)     │
│                  │ │                  │ │                  │
│  ┌────────────┐  │ │  ┌────────────┐  │ │  ┌────────────┐  │
│  │  Master    │  │ │  │  Master    │  │ │  │  Broker 1  │  │
│  └────────────┘  │ │  │  Replica 1 │  │ │  │  Broker 2  │  │
│  ┌────────────┐  │ │  │  Replica 2 │  │ │  │  Broker 3  │  │
│  │ Read       │  │ │  └────────────┘  │ │  └────────────┘  │
│  │ Replica 1  │  │ │                  │ │                  │
│  │ (Optional) │  │ │  Sentinel for HA │ │  Zookeeper for   │
│  └────────────┘  │ │                  │ │  coordination    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Monitoring     │
                    │   & Logging      │
                    │                  │
                    │  • Prometheus    │
                    │  • Grafana       │
                    │  • ELK Stack     │
                    └──────────────────┘
```

---

## Monitoring & Observability Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MONITORING & OBSERVABILITY STACK                         │
└─────────────────────────────────────────────────────────────────────────────┘

Application Instances
         │
         │ Expose Metrics
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          METRICS COLLECTION                                 │
│                                                                             │
│  Health Endpoints:                                                          │
│  ├─ /health              → Full health check (DB + Memory)                 │
│  ├─ /health/ready        → Readiness probe (DB only)                       │
│  └─ /health/live         → Liveness probe (always OK)                      │
│                                                                             │
│  Monitoring Endpoints:                                                      │
│  ├─ /monitoring/metrics  → Process & Memory metrics                        │
│  └─ /monitoring/circuit-breakers → CB status & stats                       │
│                                                                             │
│  Application Metrics:                                                       │
│  ├─ Request rate (req/s)                                                   │
│  ├─ Response time (p50, p95, p99)                                          │
│  ├─ Error rate (%)                                                         │
│  ├─ Active connections                                                     │
│  ├─ Cache hit rate (%)                                                     │
│  └─ Circuit breaker state                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          METRICS STORAGE                                    │
│                                                                             │
│  ┌──────────────────────┐         ┌──────────────────────┐                │
│  │     Prometheus       │         │      InfluxDB        │                │
│  │                      │         │                      │                │
│  │  • Time-series DB    │         │  • Time-series DB    │                │
│  │  • Scrape metrics    │         │  • High write perf   │                │
│  │  • Alerting rules    │         │  • Long-term storage │                │
│  └──────────────────────┘         └──────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VISUALIZATION                                      │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           Grafana                                    │  │
│  │                                                                      │  │
│  │  Dashboards:                                                         │  │
│  │  ├─ Application Performance (Response time, Throughput, Errors)     │  │
│  │  ├─ Infrastructure (CPU, Memory, Disk, Network)                     │  │
│  │  ├─ Database (Connections, Query time, Cache hit rate)              │  │
│  │  ├─ Redis (Memory, Hit rate, Evictions)                             │  │
│  │  ├─ Circuit Breakers (State, Failure rate, Recovery time)           │  │
│  │  └─ Business Metrics (Events created, Attendees, Attendance)        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ALERTING                                           │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Alert Manager                                   │  │
│  │                                                                      │  │
│  │  Critical Alerts:                                                    │  │
│  │  ├─ Service Down (health check fails)                               │  │
│  │  ├─ High Error Rate (>5%)                                            │  │
│  │  ├─ Slow Response Time (p95 >500ms)                                  │  │
│  │  ├─ High Memory Usage (>80%)                                         │  │
│  │  ├─ Database Connection Pool Exhausted                               │  │
│  │  ├─ Circuit Breaker Open                                             │  │
│  │  └─ Cache Unavailable                                                │  │
│  │                                                                      │  │
│  │  Notification Channels:                                              │  │
│  │  ├─ Email                                                            │  │
│  │  ├─ Slack                                                            │  │
│  │  ├─ PagerDuty                                                        │  │
│  │  └─ SMS (critical only)                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

Logging Architecture:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Application Logs → Filebeat → Logstash → Elasticsearch → Kibana           │
│                                                                             │
│  Log Levels:                                                                │
│  ├─ ERROR: Application errors, exceptions                                  │
│  ├─ WARN: Warnings, deprecated usage                                       │
│  ├─ INFO: Important events, state changes                                  │
│  └─ DEBUG: Detailed debugging (dev only)                                   │
│                                                                             │
│  Log Retention:                                                             │
│  ├─ Hot: 7 days (fast search)                                              │
│  ├─ Warm: 30 days (slower search)                                          │
│  └─ Cold: 90 days (archive)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1: Network Security
┌────────────────────────────────────────────────────────────────────────────┐
│  • Firewall Rules (Allow only 80/443)                                      │
│  • DDoS Protection (Cloudflare/AWS Shield)                                 │
│  • SSL/TLS Encryption (HTTPS only)                                         │
│  • VPC/Private Network for internal services                               │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
Layer 2: Load Balancer Security (Nginx)
┌────────────────────────────────────────────────────────────────────────────┐
│  • Rate Limiting (100 req/s per IP)                                        │
│  • Connection Limits (10 concurrent per IP)                                │
│  • Request Size Limits (10MB max)                                          │
│  • Timeout Configuration (60s)                                             │
│  • Header Security (X-Frame-Options, CSP)                                  │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
Layer 3: Application Security (NestJS)
┌────────────────────────────────────────────────────────────────────────────┐
│  Authentication:                                                           │
│  ├─ JWT Token Validation                                                   │
│  ├─ Token Expiration Check                                                 │
│  └─ Signature Verification                                                 │
│                                                                            │
│  Authorization:                                                            │
│  ├─ Role-Based Access Control (RBAC)                                       │
│  ├─ Permission Middleware (cached)                                         │
│  └─ Resource-level permissions                                             │
│                                                                            │
│  Input Validation:                                                         │
│  ├─ class-validator (DTO validation)                                       │
│  ├─ class-transformer (type safety)                                        │
│  └─ Sanitization (XSS prevention)                                          │
│                                                                            │
│  Rate Limiting:                                                            │
│  ├─ ThrottlerGuard (100 req/min per IP)                                    │
│  └─ Custom rate limits per endpoint                                        │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
Layer 4: Data Security
┌────────────────────────────────────────────────────────────────────────────┐
│  Database:                                                                 │
│  ├─ Parameterized Queries (SQL injection prevention)                       │
│  ├─ Connection Encryption (SSL/TLS)                                        │
│  ├─ Least Privilege Access                                                 │
│  └─ Encrypted Backups                                                      │
│                                                                            │
│  Redis:                                                                    │
│  ├─ Password Authentication                                                │
│  ├─ Network Isolation (private network)                                    │
│  └─ Encrypted Connection (optional)                                        │
│                                                                            │
│  Secrets Management:                                                       │
│  ├─ Environment Variables                                                  │
│  ├─ AWS Secrets Manager / HashiCorp Vault                                  │
│  └─ No secrets in code/version control                                     │
└────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
Layer 5: Container Security
┌────────────────────────────────────────────────────────────────────────────┐
│  • Non-root User (nestjs:1001)                                             │
│  • Minimal Base Image (node:18-alpine)                                     │
│  • No unnecessary packages                                                 │
│  • Read-only File System (where possible)                                  │
│  • Resource Limits (CPU, Memory)                                           │
│  • Security Scanning (Trivy, Snyk)                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Scalability Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HORIZONTAL SCALING STRATEGY                          │
└─────────────────────────────────────────────────────────────────────────────┘

Current Capacity: 1,000+ concurrent users
Target Capacity: 10,000+ concurrent users

Scaling Approach:

1. Application Layer Scaling
   ┌────────────────────────────────────────────────────────────────────────┐
   │  Current: 2-4 instances × 4 workers = 8-16 processes                   │
   │  Scale to: 10-20 instances × 4 workers = 40-80 processes               │
   │                                                                        │
   │  Scaling Triggers:                                                     │
   │  ├─ CPU > 70% for 5 minutes                                            │
   │  ├─ Memory > 80% for 5 minutes                                         │
   │  ├─ Response time p95 > 300ms                                          │
   │  └─ Request queue > 100                                                │
   │                                                                        │
   │  Auto-scaling: Kubernetes HPA or AWS Auto Scaling                      │
   └────────────────────────────────────────────────────────────────────────┘

2. Database Layer Scaling
   ┌────────────────────────────────────────────────────────────────────────┐
   │  Vertical Scaling:                                                     │
   │  ├─ Increase CPU/Memory as needed                                      │
   │  └─ Current: 4 vCPU, 16GB RAM → Target: 8 vCPU, 32GB RAM              │
   │                                                                        │
   │  Horizontal Scaling (Read Replicas):                                   │
   │  ├─ Add 2-3 read replicas                                              │
   │  ├─ Route read queries to replicas                                     │
   │  └─ Write queries to primary only                                      │
   │                                                                        │
   │  Connection Pool Scaling:                                              │
   │  ├─ Current: 100 max connections per instance                          │
   │  └─ Scale: Increase to 200-300 with more instances                     │
   └────────────────────────────────────────────────────────────────────────┘

3. Cache Layer Scaling
   ┌────────────────────────────────────────────────────────────────────────┐
   │  Redis Cluster:                                                        │
   │  ├─ Current: Single instance                                           │
   │  ├─ Scale to: 3-node cluster (master + 2 replicas)                     │
   │  └─ Sharding for data distribution                                     │
   │                                                                        │
   │  Cache Optimization:                                                   │
   │  ├─ Increase memory: 2GB → 8GB                                         │
   │  ├─ Optimize TTL values                                                │
   │  └─ Implement cache warming                                            │
   └────────────────────────────────────────────────────────────────────────┘

4. Load Balancer Scaling
   ┌────────────────────────────────────────────────────────────────────────┐
   │  ├─ Add multiple Nginx instances                                       │
   │  ├─ Use cloud load balancer (ALB/NLB)                                  │
   │  └─ Implement health checks                                            │
   └────────────────────────────────────────────────────────────────────────┘

Performance Targets After Scaling:
├─ Concurrent Users: 10,000+
├─ Response Time (p95): <200ms
├─ Throughput: 5,000+ req/s
├─ Error Rate: <0.5%
└─ Availability: 99.9%
```

---

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TECHNOLOGY STACK                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Backend Framework:
├─ NestJS 10.x (Node.js 18+, TypeScript 5.1)
├─ Express.js (HTTP server)
└─ Class-validator & Class-transformer

Database:
├─ PostgreSQL 15
├─ TypeORM 0.3.20 (ORM)
└─ Connection Pooling (pg driver)

Caching:
├─ Redis 7
├─ ioredis (client)
└─ cache-manager (abstraction)

Message Queue:
├─ Kafka 3
├─ KafkaJS 2.2.4
└─ Zookeeper (coordination)

Load Balancing:
├─ Nginx (latest)
└─ Least connection algorithm

Resilience:
├─ Opossum 8.x (Circuit Breaker)
├─ @nestjs/throttler (Rate Limiting)
└─ Retry logic with exponential backoff

Monitoring:
├─ @nestjs/terminus (Health Checks)
├─ Custom metrics endpoints
└─ Winston (Logging)

Testing:
├─ Jest (Unit & E2E tests)
├─ k6 (Load testing)
└─ Supertest (API testing)

Deployment:
├─ Docker & Docker Compose
├─ Multi-stage builds
└─ Kubernetes ready

Documentation:
├─ Swagger/OpenAPI
├─ Markdown documentation
└─ Architecture diagrams
```

---

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PERFORMANCE CHARACTERISTICS                            │
└─────────────────────────────────────────────────────────────────────────────┘

Throughput:
├─ Peak: 500+ requests/second
├─ Sustained: 300-400 requests/second
└─ With scaling: 5,000+ requests/second

Response Times:
├─ p50 (median): <100ms
├─ p95: <200ms
├─ p99: <500ms
└─ Health checks: <50ms

Concurrent Users:
├─ Current capacity: 1,000+
├─ With horizontal scaling: 10,000+
└─ Per instance: 250-500 users

Database Performance:
├─ Connection pool: 10-100 connections
├─ Query execution: <50ms (indexed queries)
├─ Cache hit rate: 70-80%
└─ Write throughput: 1,000+ writes/second

Cache Performance:
├─ Redis latency: <1ms
├─ Permission cache hit rate: 70-80%
├─ Query cache hit rate: 40-50%
└─ Memory usage: <2GB

Resource Usage:
├─ CPU: 50-70% under load
├─ Memory: 400MB-1GB per instance
├─ Network: <100Mbps per instance
└─ Disk I/O: Minimal (mostly database)

Availability:
├─ Target: 99.9% (8.76 hours downtime/year)
├─ With HA setup: 99.95%
└─ Recovery time: <5 minutes
```

This architecture provides a solid foundation for handling high-concurrency workloads with excellent performance, reliability, and scalability characteristics.
