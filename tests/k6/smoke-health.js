import http from 'k6/http';
import { check, sleep } from 'k6';

const baseURL = (__ENV.BASE_URL || 'http://127.0.0.1:12000').replace(/\/$/, '');
const path = __ENV.TARGET_PATH || '/health';

export const options = {
  vus: 2,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const response = http.get(`${baseURL}${path}`, {
    headers: __ENV.AUTH_TOKEN ? { Authorization: `Bearer ${__ENV.AUTH_TOKEN}` } : {},
    tags: { test_type: 'smoke', endpoint: path },
  });

  check(response, {
    'status HTTP esperado': (res) => res.status >= 200 && res.status < 400,
  });
  sleep(1);
}
