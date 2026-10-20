import http from 'k6/http';
import { check } from 'k6';

const baseURL = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const path = __ENV.TARGET_PATH || '/health';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 25 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const response = http.get(`${baseURL}${path}`, {
    headers: __ENV.AUTH_TOKEN ? { Authorization: `Bearer ${__ENV.AUTH_TOKEN}` } : {},
    tags: { test_type: 'stress', endpoint: path },
  });

  check(response, {
    'no responde con error 5xx': (res) => res.status < 500,
  });
}
