import type { WeatherForecast } from '../types';

function weatherLabel(code: number): string {
  if (code <= 1) return 'Despejado';
  if (code <= 3) return 'Nublado';
  if (code <= 82) return 'Lluvia';
  if (code <= 86) return 'Nieve';
  return 'Tormenta';
}

function weatherIcon(code: number): string {
  if (code <= 1) return '☀️';
  if (code <= 3) return '☁️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '❄️';
  return '⛈️';
}

function rainAdvice(day: WeatherForecast): string {
  if (day.precipitation_mm >= 8 || day.precipitation_probability >= 90) return 'Precaución: evalúa el sendero y el río.';
  if (day.precipitation_probability >= 70) return 'Recomienda impermeable y calzado con agarre.';
  return 'Condiciones favorables para la visita.';
}

function displayDay(date: string): { day: string; date: string } {
  const value = new Date(`${date}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'America/Lima' }).format(value),
    date: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(value),
  };
}

export function WeatherPanel({ days }: { days: WeatherForecast[] }) {
  const today = days[0];
  return <section className="weather-panel" aria-labelledby="weather-title">
    <div className="section-heading"><div><p className="eyebrow">OPEN-METEO · PRONÓSTICO</p><h2 id="weather-title">Condiciones para planificar la visita</h2><p>Pronóstico de la Catarata del Río Derrepente para los próximos días.</p></div><span className="source-pill">Actualizado por el backend</span></div>
    {today && <aside className="weather-highlight"><span className="weather-icon">{weatherIcon(today.weather_code)}</span><div><p className="eyebrow">HOY</p><h3>{weatherLabel(today.weather_code)} · {Math.round(today.temperature_max)} °C</h3><p>{rainAdvice(today)}</p></div><div className="rain-summary"><b>{Math.round(today.precipitation_probability)}%</b><span>probabilidad de lluvia</span></div></aside>}
    <div className="weather-table-wrap"><table className="weather-table"><thead><tr><th>Día</th><th>Condición</th><th>Máxima</th><th>Lluvia</th><th>Recomendación</th></tr></thead><tbody>
      {days.map((day, index) => {
        const date = displayDay(day.date);
        return <tr key={day.date} className={index === 0 ? 'today-row' : ''}>
          <td><b>{index === 0 ? 'Hoy' : date.day}</b><span>{date.date}</span></td>
          <td><span className="condition">{weatherIcon(day.weather_code)} {weatherLabel(day.weather_code)}</span></td>
          <td>{Math.round(day.temperature_max)} °C</td>
          <td><b>{Math.round(day.precipitation_probability)}%</b><span>{day.precipitation_mm.toFixed(1)} mm</span></td>
          <td className="weather-advice">{rainAdvice(day)}</td>
        </tr>;
      })}
    </tbody></table></div>
  </section>;
}
