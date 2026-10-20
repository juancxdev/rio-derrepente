import { sleep } from 'k6';
import { setupSession } from './lib/session.js';
import { dashboardJourney } from './lib/journey.js';

const peak = Math.max(10, Number(__ENV.STRESS_PEAK || 150));
const thinkTime = Math.max(0, Number(__ENV.STRESS_SLEEP || 0.2));
const step = (fraction) => Math.max(1, Math.round(peak * fraction));

export const options = {
  stages: [
    { duration: '30s', target: step(0.1) },
    { duration: '30s', target: step(0.25) },
    { duration: '30s', target: step(0.5) },
    { duration: '30s', target: step(0.75) },
    { duration: '1m', target: peak },
    { duration: '1m', target: peak },
    { duration: '30s', target: 0 },
  ],
  tags: { test_type: 'stress' },
  thresholds: {
    checks: ['rate>0.95'],
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    'http_req_duration{endpoint:sites}': ['p(95)<3000'],
    'http_req_duration{endpoint:closure}': ['p(95)<3000'],
    'http_req_duration{endpoint:prediction}': ['p(95)<3000'],
    'http_req_duration{endpoint:me}': ['p(95)<3000'],
  },
};

export function setup() {
  return setupSession();
}

export default function (session) {
  dashboardJourney(session);
  sleep(thinkTime);
}
