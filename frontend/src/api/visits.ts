import type { VisitSubmission } from '../types';
import { siteID } from './predictions';

export async function registerVisit(payload: VisitSubmission): Promise<void> {
  const response = await fetch(`/api/v1/sites/${siteID}/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'No se pudo registrar la visita.');
  }
}
