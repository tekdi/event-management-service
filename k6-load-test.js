import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 200 },   // Ramp up to 200 users
    { duration: '2m', target: 200 },   // Stay at 200 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.05'],   // Error rate should be less than 5%
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'Bearer test-token';

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Get events (with auth)
  const headers = {
    'Authorization': AUTH_TOKEN,
    'Content-Type': 'application/json',
  };

  const getEventsRes = http.post(
    `${BASE_URL}/event-service/api/v1/event/search`,
    JSON.stringify({
      limit: 10,
      offset: 0,
      filters: {},
    }),
    { headers }
  );

  check(getEventsRes, {
    'get events status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test 3: Create event
  const createEventPayload = {
    title: `Load Test Event ${Date.now()}`,
    description: 'Event created during load testing',
    eventType: 'offline',
    startDateTime: new Date(Date.now() + 86400000).toISOString(),
    endDateTime: new Date(Date.now() + 90000000).toISOString(),
    isRecurring: false,
  };

  const createEventRes = http.post(
    `${BASE_URL}/event-service/api/v1/event`,
    JSON.stringify(createEventPayload),
    { headers }
  );

  check(createEventRes, {
    'create event status is 201': (r) => r.status === 201,
    'response has eventId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result && body.result.eventId;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(2);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n';
  summary += `${indent}Test Summary:\n`;
  summary += `${indent}  Scenarios: ${Object.keys(data.metrics).length}\n`;
  summary += `${indent}  Duration: ${data.state.testRunDurationMs / 1000}s\n`;
  
  if (data.metrics.http_reqs) {
    summary += `${indent}  Total Requests: ${data.metrics.http_reqs.values.count}\n`;
    summary += `${indent}  Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  }
  
  if (data.metrics.http_req_duration) {
    summary += `${indent}  Response Time:\n`;
    summary += `${indent}    avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}    p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}    p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  }
  
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    summary += `${indent}  Error Rate: ${failRate}%\n`;
  }

  return summary;
}
