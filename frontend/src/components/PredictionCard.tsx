import type { Prediction } from '../types';

function recommendation(prediction: Prediction): string {
  if ((prediction.precipitation_probability ?? 0) >= 70) {
    return 'Prepara stock moderado: existe alta probabilidad de lluvia.';
  }
  if (prediction.level === 'ALTA') return 'Prepara mayor stock y personal para atender la demanda.';
  return 'Mantén una preparación moderada para el flujo esperado.';
}

type Props = { title: string; data: Prediction | null | undefined; loading: boolean };

export function PredictionCard({ title, data, loading }: Props) {
  if (loading) return <section className="card skeleton" aria-busy="true">Cargando predicción…</section>;
  if (data === null) {
    return <section className="card empty"><p className="eyebrow">{title}</p><h2>Aún no disponible</h2><p>La predicción se mostrará cuando el procesamiento diario esté listo.</p></section>;
  }
  if (!data) return null;
  return <section className="card">
    <p className="eyebrow">{title}</p>
    <strong>{Math.round(data.estimated_visitors)}</strong><span>posibles consumidores</span>
    <div className={`badge ${data.level.toLowerCase()}`}>{data.level} · {Math.round(data.score)}/100</div>
    <hr />
    <p>🌡️ Máxima: {data.temperature_max ?? '—'} °C</p>
    <p>🌧️ Lluvia: {data.precipitation_probability ?? '—'}%</p>
    <p className="advice">{recommendation(data)}</p>
  </section>;
}
