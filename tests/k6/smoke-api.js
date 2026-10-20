import { setupSession } from './lib/session.js';
import { dashboardJourney } from './lib/journey.js';

export const options = {
  vus: 1,
  iterations: 1,
  tags: { test_type: 'smoke' },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  return setupSession();
}

export default function (session) {
  dashboardJourney(session);
}
