import http from 'k6/http';
import { fail } from 'k6';
import {
  API_BASE_URL,
  TEST_EMAIL,
  TEST_PASSWORD,
  TEST_SITE_CODE,
  TEST_SITE_ID,
  TEST_TENANT_ID,
  TARGET_DATE,
  dateCandidates,
} from './config.js';

function jsonHeaders() {
  return { 'Content-Type': 'application/json' };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function pickSite(sites) {
  if (TEST_SITE_ID) {
    return sites.find((site) => site.id === TEST_SITE_ID) || null;
  }
  if (TEST_SITE_CODE) {
    return sites.find((site) => site.code === TEST_SITE_CODE) || null;
  }
  return sites[0] || null;
}

export function login() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    fail(
      'Faltan TEST_EMAIL y TEST_PASSWORD. Ejecuta ./scripts/loadtest-setup.py ' +
        'o define las variables antes de correr la prueba.'
    );
  }

  const response = http.post(
    `${API_BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    {
      headers: jsonHeaders(),
      tags: { endpoint: 'login', name: 'POST /auth/login' },
    }
  );

  if (response.status !== 200) {
    fail(
      `Login falló con HTTP ${response.status}. Revisa TEST_EMAIL/TEST_PASSWORD ` +
        'o vuelve a ejecutar ./scripts/loadtest-setup.py.'
    );
  }

  const body = response.json();
  if (!body || !body.access_token) {
    fail('El login no devolvió access_token.');
  }

  const tenantID = body.tenant && body.tenant.id;
  if (!tenantID) {
    fail('El login no devolvió tenant. Usa un usuario de tenant, no el super administrador.');
  }
  if (TEST_TENANT_ID && tenantID !== TEST_TENANT_ID) {
    fail(
      `El token pertenece al tenant ${tenantID}, pero TEST_TENANT_ID=${TEST_TENANT_ID}. ` +
        'Revisa la membership del usuario de pruebas.'
    );
  }

  const sites = Array.isArray(body.sites) ? body.sites : [];
  const site = pickSite(sites);
  if (!site) {
    fail(
      'El usuario no tiene sitios accesibles. Ejecuta ./scripts/loadtest-setup.py ' +
        'para crear el tenant, el sitio y el usuario de pruebas.'
    );
  }

  return {
    token: body.access_token,
    tenantID,
    siteID: site.id,
    siteCode: site.code,
    targetDate: TARGET_DATE,
    closureHour: body.closure_hour,
  };
}

function findPredictionDate(session) {
  for (const date of dateCandidates()) {
    const response = http.get(
      `${API_BASE_URL}/api/v1/tenants/${session.tenantID}/sites/${session.siteID}/predictions/${date}`,
      {
        headers: authHeaders(session.token),
        tags: { endpoint: 'prediction-probe', name: 'GET prediction (setup)' },
      }
    );
    if (response.status === 200) {
      return date;
    }
  }
  fail(
    'No hay predicción disponible para hoy ni para mañana. ' +
      'Ejecuta ./scripts/loadtest-setup.py o define PREDICTION_DATE con una fecha ya generada.'
  );
}

export function setupSession() {
  const session = login();
  return { ...session, predictionDate: findPredictionDate(session) };
}
