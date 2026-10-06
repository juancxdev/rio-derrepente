import { useEffect, useMemo, useState } from 'react';
import { getPrediction } from './api/predictions';
import { getWeatherForecast } from './api/weather';
import { PredictionCard, type PredictionEmptyState } from './components/PredictionCard';
import { VisitRegistration } from './components/VisitRegistration';
import { WeatherPanel } from './components/WeatherPanel';
import { dailyCycle } from './time';
import type { Prediction, WeatherForecast } from './types';

const registeredVisitKey = 'rio-derrepente:registered-visit-date';

function storedRegisteredDate(): string | null {
  try { return window.localStorage.getItem(registeredVisitKey); } catch { return null; }
}

function emptyState(canShowTomorrow: boolean, registeredDate: string | null, today: string): PredictionEmptyState {
  if (!canShowTomorrow && registeredDate !== today) return 'before-close';
  if (!canShowTomorrow) return 'awaiting-registration';
  if (registeredDate === today) return 'processing';
  return 'awaiting-registration';
}

export default function App() {
  const [clock, setClock] = useState(() => new Date());
  const [registeredDate, setRegisteredDate] = useState<string | null>(storedRegisteredDate);
  const [todayPrediction, setTodayPrediction] = useState<Prediction | null | undefined>(undefined);
  const [tomorrowPrediction, setTomorrowPrediction] = useState<Prediction | null | undefined>(null);
  const [weather, setWeather] = useState<WeatherForecast[]>([]);
  const [error, setError] = useState(false);
  const cycle = useMemo(() => dailyCycle(clock, registeredDate), [clock, registeredDate]);

  async function load() {
    setError(false);
    setTodayPrediction(undefined);
    if (cycle.canShowTomorrow) setTomorrowPrediction(undefined);
    else setTomorrowPrediction(null);
    try {
      const [today, forecast, tomorrow] = await Promise.all([
        getPrediction(cycle.today),
        getWeatherForecast(),
        cycle.canShowTomorrow ? getPrediction(cycle.tomorrow) : Promise.resolve(null),
      ]);
      setTodayPrediction(today);
      setTomorrowPrediction(tomorrow);
      setWeather(forecast.days);
    } catch { setError(true); }
  }

  useEffect(() => { void load(); }, [cycle.today, cycle.canShowTomorrow]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!cycle.canShowTomorrow || tomorrowPrediction !== null) return;
    const timer = window.setInterval(async () => {
      try {
        const prediction = await getPrediction(cycle.tomorrow);
        if (prediction) setTomorrowPrediction(prediction);
      } catch { /* El aviso principal conserva el control de errores de red. */ }
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [cycle.canShowTomorrow, cycle.tomorrow, tomorrowPrediction]);

  function handleRegistered(visitDate: string) {
    try { window.localStorage.setItem(registeredVisitKey, visitDate); } catch { /* Sin almacenamiento, la sesión actual aún puede continuar. */ }
    setRegisteredDate(visitDate);
    setTomorrowPrediction(null);
  }

  const tomorrowState = emptyState(cycle.canShowTomorrow, registeredDate, cycle.today);

  return <main className="app-shell">
    <header className="hero"><div className="hero-copy"><p className="eyebrow">CAYUMBA GRANDE · TINGO MARÍA · HUÁNUCO</p><h1>Catarata del Río Derrepente</h1><p>Información diaria para anticipar la demanda turística y planificar la atención.</p></div><nav aria-label="Secciones principales"><a href="#demanda">Demanda</a><a href="#clima">Clima</a><a href="#registro">Cierre diario</a></nav></header>
    {error ? <section className="notice" role="alert"><div><b>No pudimos actualizar la información.</b><span>Comprueba la conexión con el servicio e inténtalo nuevamente.</span></div><button onClick={load}>Reintentar</button></section> : <>
      <section id="demanda" className="demand-section" aria-labelledby="demand-title"><div className="section-heading"><div><p className="eyebrow">PANEL OPERATIVO</p><h2 id="demand-title">Demanda estimada</h2><p>La predicción de mañana solo se habilita después del cierre diario.</p></div><span className="time-pill">Hora de Lima · {cycle.registrationOpen ? 'Cierre habilitado' : 'Cierre desde las 18:00'}</span></div>
        <div className="prediction-grid"><PredictionCard title="Hoy" data={todayPrediction} loading={todayPrediction === undefined} featured /><PredictionCard title="Mañana" data={tomorrowPrediction} loading={tomorrowPrediction === undefined} emptyState={tomorrowState} /></div>
      </section>
      {weather.length > 0 && <div id="clima"><WeatherPanel days={weather} /></div>}
    </>}
    <div id="registro"><VisitRegistration enabled={cycle.registrationOpen} onRegistered={handleRegistered} /></div>
    <footer><span>Estimación generada por el modelo <b>baseline-1.0</b>.</span><span>El pronóstico visible proviene de Open-Meteo y no sustituye los datos climáticos capturados al registrar visitas.</span></footer>
  </main>;
}
