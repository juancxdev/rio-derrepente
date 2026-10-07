import type { Prediction } from '../types';

function recommendation(prediction: Prediction): string {
  if (prediction.level === 'ALTA') return 'Prepara mayor stock y personal para atender la demanda.';
  if (prediction.level === 'BAJA') return 'Ajusta el stock y la dotación al flujo previsto.';
  return 'Mantén una preparación moderada para el flujo esperado.';
}

type Props = { title: string; data: Prediction | null | undefined; loading: boolean };

export type PredictionEmptyState = 'before-close' | 'awaiting-registration' | 'processing' | 'not-available';

type CardProps = Props & { emptyState?: PredictionEmptyState; featured?: boolean };

const emptyCopy: Record<PredictionEmptyState, { title: string; body: string }> = {
  'before-close': { title: 'Se habilita después del cierre', body: 'La estimación de mañana estará disponible luego de las 18:00, cuando se cierre el registro de hoy.' },
  'awaiting-registration': { title: 'Falta registrar las visitas de hoy', body: 'Registra la afluencia del día para que el sistema pueda preparar el pronóstico de mañana.' },
  processing: { title: 'Procesando la predicción de mañana', body: 'El registro fue recibido. El modelo está combinando las visitas de hoy con el clima previsto.' },
  'not-available': { title: 'Aún no disponible', body: 'La predicción se mostrará cuando el procesamiento diario esté listo.' },
};

export function PredictionCard({ title, data, loading, emptyState = 'not-available', featured = false }: CardProps) {
  if (loading) return <section className={`card prediction-card skeleton ${featured ? 'featured' : ''}`} aria-busy="true">Cargando predicción…</section>;
  if (data === null) {
    const copy = emptyCopy[emptyState];
    return <section className={`card prediction-card empty ${featured ? 'featured' : ''}`}><p className="card-label">{title}</p><h2>{copy.title}</h2><p>{copy.body}</p></section>;
  }
  if (!data) return null;
  return <section className={`card prediction-card ${featured ? 'featured' : ''}`}>
    <div className="prediction-card-head"><p className="card-label">{title}</p><div className={`badge ${data.level.toLowerCase()}`}>{data.level} · {Math.round(data.score)}/100</div></div>
    <div className="prediction-value"><strong>{Math.round(data.estimated_visitors)}</strong><span>posibles consumidores estimados</span></div>
    <p className="advice">{recommendation(data)}</p>
  </section>;
}
