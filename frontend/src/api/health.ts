export type HealthStatus = { status: string; service: string };

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch('/health');
  if (!response.ok) throw new Error('No pudimos consultar el estado del servicio.');
  return response.json() as Promise<HealthStatus>;
}
