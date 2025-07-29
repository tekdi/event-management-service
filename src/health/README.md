# Health Check Implementation

This directory contains the health check functionality for the Event Management Service.

## Overview

The health check endpoint provides status information about critical system dependencies:
- **PostgreSQL** - Primary database connectivity
- **Kafka** - Messaging system connectivity

## Endpoint

**URL:** `GET /event-service/health`

*Note: The endpoint is prefixed with `/event-service` due to the global prefix configured in `main.ts`*

## Response Format

The endpoint returns responses in the specified format with version "3.0":

```json
{
  "id": "api.content.health",
  "ver": "3.0",
  "ts": "2025-07-29T11:01:03ZZ",
  "params": {
    "resmsgid": "fa6949cf-4e4c-422a-aa69-00965cac8a99",
    "msgid": null,
    "err": null,
    "status": "successful",
    "errmsg": null
  },
  "responseCode": "OK",
  "result": {
    "checks": [
      { "name": "postgresql", "healthy": true },
      { "name": "kafka", "healthy": true }
    ],
    "healthy": true
  }
}
```

## Health Checks

### PostgreSQL
- **Method**: Executes `SELECT 1` query via TypeORM DataSource
- **Healthy**: Query executes successfully
- **Unhealthy**: Database connection not initialized or query fails

### Kafka
- **Method**: Fetches metadata via Kafka admin client
- **Healthy**: Successfully connects and fetches metadata
- **Unhealthy**: Connection fails or Kafka is disabled
- **Note**: If Kafka is disabled in configuration, it's considered healthy

## Files

- `health.controller.ts` - HTTP controller handling GET /health requests
- `health.service.ts` - Business logic for health checks and response formatting
- `health.module.ts` - NestJS module configuration
- `health.controller.spec.ts` - Unit tests for controller
- `health.service.spec.ts` - Unit tests for service with different scenarios
- `health.integration.spec.ts` - Integration tests validating response format

## Integration

The health module is integrated into the main application via `app.module.ts` and is available immediately when the application starts.