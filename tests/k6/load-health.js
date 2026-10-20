import http from 'k6/http';
import { check, sleep } from 'k6';

const baseURL = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const path = __ENV.TARGET_PATH || '/health';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const response = http.get(`${baseURL}${path}`, {
    headers: __ENV.AUTH_TOKEN ? { Authorization: `Bearer ${__ENV.AUTH_TOKEN}` } : {},
    tags: { test_type: 'load', endpoint: path },
  });

  check(response, {
    'status HTTP esperado': (res) => res.status >= 200 && res.status < 400,
  });
  sleep(1);
}
