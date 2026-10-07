import { useEffect, useMemo, useState } from 'react';
import { getPrediction } from './api/predictions';
import { getWeatherForecast } from './api/weather';
import { MonitoringPanel } from './components/MonitoringPanel';
import { PredictionCard, type PredictionEmptyState } from './components/PredictionCard';
import { VisitRegistration } from './components/VisitRegistration';
import { WeatherPanel } from './components/WeatherPanel';
import { dailyCycle } from './time';
import type { Prediction, WeatherForecast } from './types';

const registeredVisitKey = 'rio-derrepente:registered-visit-date';
type View = 'summary' | 'admin' | 'monitoring';

function viewFromHash(): View {
  const value = window.location.hash.replace('#', '');
  return ['summary', 'admin', 'monitoring'].includes(value) ? value as View : 'summary';
}

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
  const [view, setView] = useState<View>(viewFromHash);
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
  const todayCardPrediction = todayPrediction;
  const tomorrowCardPrediction = tomorrowPrediction;

  function changeView(next: View) {
    setView(next);
    window.history.replaceState(null, '', `#${next}`);
  }

  return <main className="app-shell">
    <div className="app-layout">
      <aside className="sidebar"><div className="brand"><span className="brand-mark">RD</span><div><b>Río Derrepente</b><span>Panel de afluencia</span></div></div><nav aria-label="Navegación de la plataforma" className="sidebar-nav">
        <button className={view === 'summary' ? 'active' : ''} aria-current={view === 'summary' ? 'page' : undefined} onClick={() => changeView('summary')}>Resumen</button>
        <button className={view === 'admin' ? 'active' : ''} aria-current={view === 'admin' ? 'page' : undefined} onClick={() => changeView('admin')}>Administración</button>
        <button className={view === 'monitoring' ? 'active' : ''} aria-current={view === 'monitoring' ? 'page' : undefined} onClick={() => changeView('monitoring')}>Monitoreo</button>
      </nav><div className="sidebar-note"><span>Destino monitoreado</span><b>Catarata del Río Derrepente</b></div></aside>
      <div className="workspace"><header className="workspace-header"><div><p className="location-label">Catarata del Río Derrepente · Tingo María</p><h1>{view === 'summary' ? 'Resumen operativo' : view === 'admin' ? 'Administración' : 'Monitoreo'}</h1></div><span className="time-pill">{cycle.registrationOpen ? 'Cierre habilitado' : 'Cierre desde las 18:00'}</span></header>
        {error && <section className="notice" role="alert"><div><b>No pudimos actualizar la información.</b><span>Comprueba la conexión con el servicio e inténtalo nuevamente.</span></div><button onClick={load}>Reintentar</button></section>}
        {!error && view === 'summary' && <><section className="workspace-intro"><div><h2>Demanda estimada</h2><p>Una lectura clara para organizar atención, stock y personal durante la jornada.</p></div></section><div className="prediction-grid"><PredictionCard title="Hoy" data={todayCardPrediction} loading={todayPrediction === undefined} featured /><PredictionCard title="Mañana" data={tomorrowCardPrediction} loading={tomorrowPrediction === undefined} emptyState={tomorrowState} /></div>{weather.length > 0 ? <WeatherPanel days={weather} /> : <section className="empty-workspace"><h2>Pronóstico no disponible</h2><p>Intenta actualizar cuando el servicio meteorológico esté disponible.</p></section>}</>}
        {view === 'admin' && <><section className="workspace-intro"><div><h2>Cierre y registro diario</h2><p>Registra la afluencia real al final de la jornada. Este dato desencadena el cálculo de mañana.</p></div></section><VisitRegistration enabled={cycle.registrationOpen} onRegistered={handleRegistered} /></>}
        {view === 'monitoring' && <MonitoringPanel />}
      </div>
    </div>
  </main>;
}
