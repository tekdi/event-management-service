.PHONY: help install build start start-cluster start-dev stop clean test lint migrate load-test health logs

# Default target
help:
	@echo "Event Management Service - High Concurrency Setup"
	@echo ""
	@echo "Available commands:"
	@echo "  make install        - Install dependencies"
	@echo "  make build          - Build the application"
	@echo "  make start          - Start with Docker Compose"
	@echo "  make start-cluster  - Start in cluster mode (local)"
	@echo "  make start-dev      - Start in development mode"
	@echo "  make stop           - Stop all services"
	@echo "  make clean          - Clean up containers and volumes"
	@echo "  make test           - Run tests"
	@echo "  make lint           - Run linter"
	@echo "  make migrate        - Run database migrations"
	@echo "  make load-test      - Run load tests with k6"
	@echo "  make health         - Check service health"
	@echo "  make logs           - View service logs"
	@echo "  make scale          - Scale event service to 4 instances"
	@echo "  make metrics        - View monitoring metrics"
	@echo "  make circuit        - View circuit breaker status"

# Install dependencies
install:
	npm install

# Build application
build:
	npm run build

# Start all services with Docker Compose
start:
	docker-compose up -d
	@echo "Services started. Access at http://localhost"
	@echo "Health check: http://localhost/health"
	@echo "Swagger docs: http://localhost/api/swagger-docs"

# Start in cluster mode (local)
start-cluster: build
	npm run start:cluster

# Start in development mode
start-dev:
	npm run start:dev

# Stop all services
stop:
	docker-compose down

# Clean up everything
clean:
	docker-compose down -v
	rm -rf node_modules dist
	@echo "Cleaned up containers, volumes, and build artifacts"

# Run tests
test:
	npm run test

# Run linter
lint:
	npm run lint

# Run database migrations
migrate:
	@echo "Running database migrations..."
	docker-compose exec postgres psql -U postgres -d event_management -f /migrations/001_add_performance_indexes.sql || \
	psql -U postgres -d event_management -f migrations/001_add_performance_indexes.sql
	@echo "Migrations completed"

# Run load tests
load-test:
	@echo "Running load tests..."
	@if command -v k6 >/dev/null 2>&1; then \
		k6 run k6-load-test.js; \
	else \
		echo "k6 not installed. Install with: brew install k6 (macOS) or see https://k6.io/docs/getting-started/installation/"; \
	fi

# Check service health
health:
	@echo "Checking service health..."
	@curl -s http://localhost/health | jq '.' || echo "Service not responding"

# View logs
logs:
	docker-compose logs -f event-service

# Scale event service
scale:
	docker-compose up -d --scale event-service=4
	@echo "Scaled event-service to 4 instances"
	docker-compose ps event-service

# View monitoring metrics
metrics:
	@echo "Application Metrics:"
	@curl -s http://localhost/monitoring/metrics | jq '.'

# View circuit breaker status
circuit:
	@echo "Circuit Breaker Status:"
	@curl -s http://localhost/monitoring/circuit-breakers | jq '.'

# Quick setup (install, start, migrate)
setup: install start
	@echo "Waiting for services to be ready..."
	@sleep 10
	@make migrate
	@make health
	@echo ""
	@echo "Setup complete! Service is ready."
	@echo "Access at: http://localhost"

# Development workflow
dev: install start-dev

# Production deployment
deploy: build
	@echo "Building production image..."
	docker-compose build
	@echo "Starting production services..."
	docker-compose up -d
	@echo "Scaling services..."
	docker-compose up -d --scale event-service=4
	@echo "Running migrations..."
	@sleep 10
	@make migrate
	@echo "Deployment complete!"
	@make health

# Monitor (watch health and metrics)
monitor:
	@echo "Monitoring service (Ctrl+C to stop)..."
	@while true; do \
		clear; \
		echo "=== Health Status ==="; \
		curl -s http://localhost/health | jq '.'; \
		echo ""; \
		echo "=== Metrics ==="; \
		curl -s http://localhost/monitoring/metrics | jq '.memory, .process'; \
		echo ""; \
		echo "=== Circuit Breakers ==="; \
		curl -s http://localhost/monitoring/circuit-breakers | jq '.'; \
		sleep 5; \
	done

# Restart services
restart:
	docker-compose restart event-service
	@echo "Services restarted"

# View all container stats
stats:
	docker stats

# Backup database
backup:
	@echo "Creating database backup..."
	docker-compose exec -T postgres pg_dump -U postgres event_management > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup created: backup_$(shell date +%Y%m%d_%H%M%S).sql"

# Restore database
restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup file name: " backup_file; \
	docker-compose exec -T postgres psql -U postgres event_management < $$backup_file
	@echo "Database restored"
