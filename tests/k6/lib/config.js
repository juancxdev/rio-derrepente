// Configuración compartida por las pruebas de API.
//
// API_BASE_URL lo inyecta docker-compose.monitoring.yml cuando k6 corre en
// Docker (por defecto http://api:8080). Desde el host se puede usar:
//   API_BASE_URL=http://127.0.0.1:12001 k6 run tests/k6/smoke-api.js

export const API_BASE_URL = (__ENV.API_BASE_URL || 'http://127.0.0.1:12001').replace(/\/+$/, '');

export const TEST_EMAIL = __ENV.TEST_EMAIL || '';
export const TEST_PASSWORD = __ENV.TEST_PASSWORD || '';
export const TEST_TENANT_ID = __ENV.TEST_TENANT_ID || '';
export const TEST_SITE_ID = __ENV.TEST_SITE_ID || '';
export const TEST_SITE_CODE = __ENV.TEST_SITE_CODE || '';

export const PREDICTION_DATE = __ENV.PREDICTION_DATE || '';
export const TARGET_DATE = __ENV.TARGET_DATE || todayUTC();

export const INCLUDE_WEATHER = (__ENV.INCLUDE_WEATHER || 'false').toLowerCase() === 'true';
export const WEATHER_DAYS = __ENV.WEATHER_DAYS || '1';

export function todayUTC(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

export function dateCandidates() {
  const values = [PREDICTION_DATE, todayUTC(), todayUTC(1)];
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
