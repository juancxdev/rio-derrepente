import type { WeatherForecast } from '../types';
import { weatherLabel } from '../weatherPresentation';

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
    <div className="section-heading"><div><p className="eyebrow">Pronóstico meteorológico</p><h2 id="weather-title">Condiciones para planificar la visita</h2><p>Consulta el clima previsto para la catarata y anticipa necesidades de atención y seguridad.</p></div><span className="source-pill">Datos servidos por el backend</span></div>
    {today && <aside className="weather-highlight"><div><p className="eyebrow">Condición de hoy</p><h3>{weatherLabel(today.weather_code)}</h3><p>{rainAdvice(today)}</p></div><dl className="weather-highlight-metrics"><div><dt>Máxima</dt><dd>{Math.round(today.temperature_max)} °C</dd></div><div><dt>Probabilidad</dt><dd>{Math.round(today.precipitation_probability)}%</dd></div><div><dt>Precipitación</dt><dd>{today.precipitation_mm.toFixed(1)} mm</dd></div></dl></aside>}
    <div className="weather-table-wrap"><table className="weather-table"><thead><tr><th>Día</th><th>Condición</th><th>Máxima</th><th>Lluvia</th><th>Recomendación</th></tr></thead><tbody>
      {days.map((day, index) => {
        const date = displayDay(day.date);
        return <tr key={day.date} className={index === 0 ? 'today-row' : ''}>
          <td><b>{index === 0 ? 'Hoy' : date.day}</b><span>{date.date}</span></td>
          <td><span className="condition">{weatherLabel(day.weather_code)}</span></td>
          <td>{Math.round(day.temperature_max)} °C</td>
          <td><b>{Math.round(day.precipitation_probability)}%</b><span>{day.precipitation_mm.toFixed(1)} mm</span></td>
          <td className="weather-advice">{rainAdvice(day)}</td>
        </tr>;
      })}
    </tbody></table></div>
  </section>;
}
