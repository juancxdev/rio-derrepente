import http from 'k6/http';
import { check } from 'k6';
import { API_BASE_URL, INCLUDE_WEATHER, WEATHER_DAYS } from './config.js';

function params(session, endpoint, name) {
  return {
    headers: { Authorization: `Bearer ${session.token}` },
    tags: { endpoint, name },
  };
}

export function getMe(session) {
  const response = http.get(
    `${API_BASE_URL}/api/v1/auth/me`,
    params(session, 'me', 'GET /auth/me')
  );
  check(response, {
    'me: HTTP 200': (res) => res.status === 200,
    'me: usuario': (res) => Boolean(res.json('user.email')),
  });
}

export function listSites(session) {
  const response = http.get(
    `${API_BASE_URL}/api/v1/tenants/${session.tenantID}/sites`,
    params(session, 'sites', 'GET /tenants/{tenant}/sites')
  );
  check(response, {
    'sites: HTTP 200': (res) => res.status === 200,
    'sites: lista': (res) => Array.isArray(res.json()),
    'sites: no vacía': (res) => Array.isArray(res.json()) && res.json().length > 0,
  });
}

export function getClosure(session, date) {
  const response = http.get(
    `${API_BASE_URL}/api/v1/tenants/${session.tenantID}/sites/${session.siteID}/closures/${date}`,
    params(session, 'closure', 'GET /tenants/{tenant}/sites/{site}/closures/{date}')
  );
  check(response, {
    'closure: HTTP 200': (res) => res.status === 200,
    'closure: estado': (res) => typeof res.json('status') === 'string',
    'closure: fecha': (res) => res.json('date') === date,
  });
}

export function getPrediction(session, date) {
  const response = http.get(
    `${API_BASE_URL}/api/v1/tenants/${session.tenantID}/sites/${session.siteID}/predictions/${date}`,
    params(session, 'prediction', 'GET /tenants/{tenant}/sites/{site}/predictions/{date}')
  );
  check(response, {
    'prediction: HTTP 200': (res) => res.status === 200,
    'prediction: visitantes': (res) => typeof res.json('estimated_visitors') === 'number',
    'prediction: nivel': (res) => typeof res.json('level') === 'string',
  });
}

export function getWeather(session) {
  const response = http.get(
    `${API_BASE_URL}/api/v1/tenants/${session.tenantID}/sites/${session.siteID}/weather/forecast?days=${WEATHER_DAYS}`,
    params(session, 'weather', 'GET /tenants/{tenant}/sites/{site}/weather/forecast')
  );
  check(response, {
    'weather: HTTP 200': (res) => res.status === 200,
    'weather: días': (res) => Array.isArray(res.json('days')) && res.json('days').length > 0,
  });
}

/**
 * Flujo de lectura equivalente a cargar el dashboard:
 * sesión, lista de sitios, cierre del día y predicción.
 * El clima queda fuera por defecto porque depende de Open-Meteo.
 */
export function dashboardJourney(session) {
  getMe(session);
  listSites(session);
  getClosure(session, session.targetDate);
  getPrediction(session, session.predictionDate);
  if (INCLUDE_WEATHER) {
    getWeather(session);
  }
}
