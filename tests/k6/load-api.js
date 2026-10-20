import { sleep } from 'k6';
import { setupSession } from './lib/session.js';
import { dashboardJourney } from './lib/journey.js';

const peak = Math.max(1, Number(__ENV.LOAD_PEAK || 25));

export const options = {
  stages: [
    { duration: '30s', target: Math.max(1, Math.round(peak * 0.2)) },
    { duration: '1m', target: Math.max(1, Math.round(peak * 0.4)) },
    { duration: '2m', target: peak },
    { duration: '30s', target: 0 },
  ],
  tags: { test_type: 'load' },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:sites}': ['p(95)<500'],
    'http_req_duration{endpoint:closure}': ['p(95)<500'],
    'http_req_duration{endpoint:prediction}': ['p(95)<500'],
    'http_req_duration{endpoint:me}': ['p(95)<500'],
    'http_req_duration{endpoint:weather}': ['p(95)<3000'],
  },
};

export function setup() {
  return setupSession();
}

export default function (session) {
  dashboardJourney(session);
  sleep(1);
}
