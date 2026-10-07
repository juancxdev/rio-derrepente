import type { WeatherForecast } from '../types';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from '@phosphor-icons/react';
import { limaDate } from '../time';
import { weatherLabel, weatherScene } from '../weatherPresentation';

function WeatherIcon({ code }: { code: number }) {
  const common = { size: 34, weight: 'duotone' as const, 'aria-hidden': true };
  switch (weatherScene(code)) {
    case 'clear': return <Sun {...common} />;
    case 'partly-cloudy': return <CloudSun {...common} />;
    case 'overcast': return <Cloud {...common} />;
    case 'fog': return <CloudFog {...common} />;
    case 'snow': return <CloudSnow {...common} />;
    case 'storm': return <CloudLightning {...common} />;
    default: return <CloudRain {...common} />;
  }
}

function displayDay(date: string): { day: string; date: string } {
  const value = new Date(`${date}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat('es-PE', { weekday: 'long', timeZone: 'America/Lima' }).format(value),
    date: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(value),
  };
}

export function WeatherPanel({ days }: { days: WeatherForecast[] }) {
  const todayDate = limaDate();
  const tomorrowDate = limaDate(new Date(Date.now() + 86_400_000));
  const today = days.find((day) => day.date === todayDate) ?? days[0];
  if (!today) return null;
  const scene = weatherScene(today.weather_code);

  return <section className={`weather-panel weather-panel-visual weather-scene-${scene}`} aria-labelledby="weather-title">
    <div className="weather-panel-title"><h2 id="weather-title">Pronóstico del clima</h2><span>Semana en curso</span></div>
    <div className="weather-day-rail" aria-label="Clima de la semana en curso">
      {days.slice(0, 7).map((day) => {
        const date = displayDay(day.date);
        const isToday = day.date === todayDate;
        const label = isToday ? 'Hoy' : day.date === tomorrowDate ? 'Mañana' : date.day;
        return <article key={day.date} className={`weather-day ${isToday ? 'today' : ''}`}>
          <div className="weather-day-content">
            <p className="weather-day-name">{label}</p>
            <span>{date.date}</span>
            <span className="weather-icon"><WeatherIcon code={day.weather_code} /></span>
            <b>{weatherLabel(day.weather_code)}</b>
            <strong>{Math.round(day.temperature_max)}°</strong>
            <small>{day.observed ? `Observado · ${day.precipitation_mm.toFixed(1)} mm` : `${Math.round(day.precipitation_probability ?? 0)}% · ${day.precipitation_mm.toFixed(1)} mm`}</small>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
