# Quick Start Guide - High Concurrency Setup

This guide will help you quickly set up and run the optimized Event Management Service.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (if running locally)
- Redis 7+ (if running locally)
- Kafka 3+ (if running locally)

## Option 1: Docker Compose (Recommended)

This is the easiest way to get started with all optimizations enabled.

### Step 1: Clone and Configure

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your settings (optional, defaults work for Docker)
nano .env
```

### Step 2: Start All Services

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f event-service
```

### Step 3: Verify Setup

```bash
# Health check
curl http://localhost/health

# Expected response:
# {
#   "status": "ok",
#   "info": {
#     "database": { "status": "up" },
#     "memory_heap": { "status": "up" },
#     "memory_rss": { "status": "up" }
#   }
# }

# Check monitoring metrics
curl http://localhost/monitoring/metrics

# Check circuit breaker status
curl http://localhost/monitoring/circuit-breakers
```

### Step 4: Run Database Migrations

```bash
# Access PostgreSQL container
docker-compose exec postgres psql -U postgres -d event_management

# Or run migration directly
docker-compose exec postgres psql -U postgres -d event_management -f /migrations/001_add_performance_indexes.sql
```

### Step 5: Scale Services (Optional)

```bash
# Scale to 4 instances
docker-compose up -d --scale event-service=4

# Verify scaling
docker-compose ps event-service
```

## Option 2: Local Development

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Up Infrastructure

Start required services:

```bash
# Using Docker for infrastructure only
docker-compose up -d postgres redis kafka zookeeper

# Or install locally (macOS example)
brew install postgresql@15 redis kafka
brew services start postgresql@15
brew services start redis
brew services start kafka
```

### Step 3: Configure Environment

```bash
cp .env.example .env

# Edit for local setup
nano .env
```

Update these values for local development:
```env
NODE_ENV=development
POSTGRES_HOST=localhost
REDIS_HOST=localhost
KAFKA_BROKERS=localhost:9092
```

### Step 4: Run Migrations

```bash
psql -U postgres -d event_management -f migrations/001_add_performance_indexes.sql
```

### Step 5: Start Application

```bash
# Development mode (single instance)
npm run start:dev

# Production mode with clustering
npm run build
npm run start:cluster
```

## Testing the Setup

### 1. Basic API Test

```bash
# Create an event
curl -X POST http://localhost:3000/event-service/api/v1/event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Event",
    "description": "Testing high concurrency setup",
    "eventType": "offline",
    "startDateTime": "2026-03-01T10:00:00Z",
    "endDateTime": "2026-03-01T12:00:00Z",
    "isRecurring": false
  }'

# Search events
curl -X POST http://localhost:3000/event-service/api/v1/event/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "limit": 10,
    "offset": 0,
    "filters": {}
  }'
```

### 2. Load Testing

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

Run load test:
```bash
# Set your auth token
export AUTH_TOKEN="Bearer YOUR_TOKEN"
export BASE_URL="http://localhost"

# Run test
k6 run k6-load-test.js
```

### 3. Monitor Performance

```bash
# Watch health status
watch -n 2 'curl -s http://localhost/health | jq'

# Monitor metrics
watch -n 5 'curl -s http://localhost/monitoring/metrics | jq'

# Check circuit breakers
watch -n 5 'curl -s http://localhost/monitoring/circuit-breakers | jq'

# Monitor Docker stats
docker stats
```

## Performance Verification

### Expected Metrics

After setup, you should see:

1. **Response Times:**
   - p50: < 100ms
   - p95: < 200ms
   - p99: < 500ms

2. **Throughput:**
   - 500+ requests/second
   - 1000+ concurrent users

3. **Resource Usage:**
   - CPU: 50-70% under load
   - Memory: < 2GB per instance
   - Database connections: 10-100 (pooled)

4. **Cache Performance:**
   - Hit rate: 70-80%
   - Response time improvement: 2-3x

### Monitoring Dashboard

Access monitoring endpoints:

- Health: http://localhost/health
- Metrics: http://localhost/monitoring/metrics
- Circuit Breakers: http://localhost/monitoring/circuit-breakers
- Swagger API: http://localhost/api/swagger-docs

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Restart specific service
docker-compose restart event-service

# Rebuild if needed
docker-compose up -d --build
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U postgres -c "SELECT 1"

# Check connection pool
curl http://localhost/health
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping

# Should return: PONG
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Reduce cache size in src/cache/cache.module.ts
# Reduce worker count in docker-compose.yml
```

### Rate Limiting Issues

```bash
# Check Nginx logs
docker-compose logs nginx | grep "limiting"

# Adjust limits in nginx.conf if needed
```

## Next Steps

1. **Configure External Services:**
   - Set up User Service URL
   - Configure Attendance Service URL
   - Add Zoom API credentials

2. **Set Up Monitoring:**
   - Install Prometheus/Grafana
   - Configure alerting
   - Set up log aggregation

3. **Production Deployment:**
   - Use managed PostgreSQL (RDS, Cloud SQL)
   - Use managed Redis (ElastiCache, MemoryStore)
   - Use managed Kafka (MSK, Confluent Cloud)
   - Set up CI/CD pipeline
   - Configure SSL/TLS
   - Set up backup strategy

4. **Optimize Further:**
   - Add read replicas
   - Implement database partitioning
   - Add CDN for static assets
   - Set up multi-region deployment

## Useful Commands

```bash
# Docker Compose
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose logs -f            # Follow logs
docker-compose ps                 # List services
docker-compose restart            # Restart services

# Scaling
docker-compose up -d --scale event-service=4

# Database
docker-compose exec postgres psql -U postgres -d event_management

# Redis
docker-compose exec redis redis-cli

# Application
npm run start:dev                 # Development mode
npm run build                     # Build for production
npm run start:cluster             # Production with clustering
npm run test                      # Run tests
npm run lint                      # Lint code
```

## Support

For detailed information, see:
- [PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md) - Complete documentation
- [README.md](./README.md) - General project information

For issues:
1. Check logs: `docker-compose logs -f`
2. Verify health: `curl http://localhost/health`
3. Check metrics: `curl http://localhost/monitoring/metrics`
