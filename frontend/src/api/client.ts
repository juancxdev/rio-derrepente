let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(value: string | null) {
  authToken = value;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type ApiInit = RequestInit & { skipUnauthorizedHandler?: boolean };

export async function apiFetch(path: string, init: ApiInit = {}): Promise<Response> {
  const { skipUnauthorizedHandler = false, ...request } = init;
  const headers = new Headers(request.headers);
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  const isLogin = path.endsWith('/auth/login');
  if (request.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, { ...request, headers });
  } catch {
    throw new ApiError(0, 'network_error', 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.');
  }
  if (response.status === 401 && !isLogin && !skipUnauthorizedHandler) unauthorizedHandler?.();
  return response;
}

async function errorFrom(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  const message = body?.error?.message ?? 'No pudimos completar la operación.';
  return new ApiError(response.status, body?.error?.code ?? 'request_failed', message);
}

export async function apiJSON<T>(path: string, init: ApiInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) throw await errorFrom(response);
  return response.json() as Promise<T>;
}

export async function apiNoContent(path: string, init: ApiInit = {}): Promise<void> {
  const response = await apiFetch(path, init);
  if (!response.ok) throw await errorFrom(response);
}

export function errorMessage(error: unknown, fallback = 'No pudimos completar la operación.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
