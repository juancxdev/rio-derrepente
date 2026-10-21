export type HealthStatus = { status: string; service: string };

export async function getHealth(): Promise<HealthStatus> {
  const apiBaseURL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  const healthPath = apiBaseURL ? '/health' : '/api/health';
  const response = await fetch(`${apiBaseURL}${healthPath}`);
  if (!response.ok) throw new Error('No pudimos consultar el estado del servicio.');
  return response.json() as Promise<HealthStatus>;
}
