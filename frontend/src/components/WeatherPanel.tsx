import type { WeatherForecast } from '../types';

function weatherLabel(code: number): string {
  if (code <= 1) return 'Despejado';
  if (code <= 3) return 'Nublado';
  if (code <= 67) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  return 'Tormenta';
}

export function WeatherPanel({ days }: { days: WeatherForecast[] }) {
  return <section className="weather-panel" aria-labelledby="weather-title">
    <div><p className="eyebrow">OPEN-METEO · PRONÓSTICO</p><h2 id="weather-title">Clima de los próximos días</h2></div>
    <div className="weather-list">
      {days.map((day) => <article className="weather-day" key={day.date}>
        <strong>{new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(new Date(`${day.date}T12:00:00Z`))}</strong>
        <span>{weatherLabel(day.weather_code)}</span>
        <span>{Math.round(day.temperature_max)} °C</span>
        <span>☔ {Math.round(day.precipitation_probability)}%</span>
      </article>)}
    </div>
  </section>;
}
