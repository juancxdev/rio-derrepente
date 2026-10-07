import type { Prediction } from '../types';
import { weatherLabel } from '../weatherPresentation';

function recommendation(prediction: Prediction): string {
  if ((prediction.precipitation_probability ?? 0) >= 70) {
    return 'Prepara stock moderado: existe alta probabilidad de lluvia.';
  }
  if (prediction.level === 'ALTA') return 'Prepara mayor stock y personal para atender la demanda.';
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
    return <section className={`card prediction-card empty ${featured ? 'featured' : ''}`}><p className="eyebrow">{title}</p><h2>{copy.title}</h2><p>{copy.body}</p></section>;
  }
  if (!data) return null;
  const hasWeather = data.temperature_max !== undefined
    || data.precipitation_probability !== undefined
    || data.precipitation_mm !== undefined
    || data.weather_code !== undefined;
  return <section className={`card prediction-card ${featured ? 'featured' : ''}`}>
    <div className="prediction-card-head"><p className="eyebrow">{title}</p><div className={`badge ${data.level.toLowerCase()}`}>{data.level} · {Math.round(data.score)}/100</div></div>
    <div className="prediction-value"><strong>{Math.round(data.estimated_visitors)}</strong><span>posibles consumidores estimados</span></div>
    {hasWeather ? <dl className="prediction-metrics"><div><dt>Condición prevista</dt><dd>{weatherLabel(data.weather_code)}</dd></div><div><dt>Temperatura máxima</dt><dd>{data.temperature_max === undefined ? 'No disponible' : `${Math.round(data.temperature_max)} °C`}</dd></div><div><dt>Probabilidad de lluvia</dt><dd>{data.precipitation_probability === undefined ? 'No disponible' : `${Math.round(data.precipitation_probability)}%`}</dd></div><div><dt>Precipitación</dt><dd>{data.precipitation_mm === undefined ? 'No disponible' : `${data.precipitation_mm.toFixed(1)} mm`}</dd></div></dl> : <p className="weather-unavailable">El contexto climático para esta fecha aún no está disponible.</p>}
    <p className="advice">{recommendation(data)}</p>
  </section>;
}
