import { ArrowClockwise, Clock, MapPin, Ticket, TrendUp } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { getPrediction } from '../api/predictions';
import { getClosureStatus } from '../api/ticketing';
import { getWeatherForecast } from '../api/weather';
import { Alert, Badge, Button, Card, EmptyState, Metric, PageHeader, Skeleton } from '../design-system';
import { PredictionCard, type PredictionEmptyState } from '../components/PredictionCard';
import { WeatherPanel } from '../components/WeatherPanel';
import { useTenant } from '../tenant/TenantContext';
import { dailyCycle, formatLongDate } from '../time';
import type { ClosureStatus, Prediction, WeatherForecast } from '../types';

function closureBadge(status: ClosureStatus | null) {
  if (!status) return <Badge tone="neutral">Consultando</Badge>;
  if (status.status === 'ready') return <Badge tone="success">Predicción lista</Badge>;
  if (status.status === 'processing') return <Badge tone="warning">Procesando</Badge>;
  return <Badge tone="neutral">Pendiente de cierre</Badge>;
}

export function SummaryView() {
  const { tenant, activeSite, closureHour } = useTenant();
  const [clock, setClock] = useState(() => new Date());
  const [todayPrediction, setTodayPrediction] = useState<Prediction | null | undefined>(undefined);
  const [tomorrowPrediction, setTomorrowPrediction] = useState<Prediction | null | undefined>(null);
  const [weather, setWeather] = useState<WeatherForecast[]>([]);
  const [closure, setClosure] = useState<ClosureStatus | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const cycle = useMemo(() => dailyCycle(clock, activeSite?.timezone, closureHour), [clock, activeSite?.timezone, closureHour]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!tenant || !activeSite) return;
    let cancelled = false;
    setError(false);
    setTodayPrediction(undefined);
    setClosure(null);
    setTomorrowPrediction(cycle.canShowTomorrow ? undefined : null);
    async function load() {
      try {
        const [today, forecast, tomorrow, closureStatus] = await Promise.all([
          getPrediction(tenant!.id, activeSite!.id, cycle.today),
          getWeatherForecast(tenant!.id, activeSite!.id, 7),
          cycle.canShowTomorrow ? getPrediction(tenant!.id, activeSite!.id, cycle.tomorrow) : Promise.resolve(null),
          getClosureStatus(tenant!.id, activeSite!.id, cycle.today),
        ]);
        if (cancelled) return;
        setTodayPrediction(today);
        setTomorrowPrediction(tomorrow);
        setWeather(forecast.days);
        setClosure(closureStatus);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [tenant, activeSite, cycle.today, cycle.tomorrow, cycle.canShowTomorrow, reloadKey]);

  // After the closure, poll the persisted prediction and closure state. No
  // localStorage or manual browser registration is involved.
  useEffect(() => {
    if (!tenant || !activeSite || !cycle.canShowTomorrow) return;
    const waiting = tomorrowPrediction === null || tomorrowPrediction === undefined || closure?.status === 'processing';
    if (!waiting) return;
    const timer = window.setInterval(async () => {
      try {
        const [prediction, status] = await Promise.all([
          getPrediction(tenant.id, activeSite.id, cycle.tomorrow),
          getClosureStatus(tenant.id, activeSite.id, cycle.today),
        ]);
        setTomorrowPrediction(prediction);
        setClosure(status);
      } catch {
        // The main retry alert keeps ownership of network errors.
      }
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [tenant, activeSite, cycle.canShowTomorrow, cycle.today, cycle.tomorrow, tomorrowPrediction, closure?.status]);

  if (!tenant || !activeSite) {
    return <EmptyState icon={MapPin} title="Sin destino activo" description="Tu usuario no tiene destinos habilitados. Pide a un administrador que asigne uno a tu tenant." />;
  }

  const tomorrowState: PredictionEmptyState = cycle.canShowTomorrow ? 'processing' : 'before-close';
  const loadingWeather = weather.length === 0 && !error;

  return (
    <>
      <PageHeader
        title="Resumen operativo"
        description={`${formatLongDate(cycle.today, activeSite.timezone)} · ${activeSite.timezone} · cierre automático a las ${cycle.closureHour}:00`}
        actions={<Button variant="secondary" icon={ArrowClockwise} onClick={() => setReloadKey((value) => value + 1)}>Actualizar</Button>}
      />

      {error ? (
        <Alert
          tone="danger"
          title="No pudimos actualizar la información"
          action={<Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>Reintentar</Button>}
        >
          Comprueba la conexión con el servicio. La última información válida no se reemplaza por datos inventados.
        </Alert>
      ) : null}

      <div className="metric-row">
        <Metric label="Tickets emitidos hoy" value={closure ? closure.tickets : '—'} hint="Ventas presenciales del destino" tone="accent" />
        <Metric label="Cierre automático" value={closureBadge(closure)} hint={`Worker a las ${cycle.closureHour}:00 hora local`} />
        <Metric label="Predicción de mañana" value={closure?.prediction_available ? 'Persistida' : cycle.canShowTomorrow ? 'En preparación' : 'Pendiente'} hint={closure?.prediction_available ? 'Dato guardado por el servicio ML' : 'Se consulta al Worker y al ML'} />
      </div>

      <div className="prediction-grid">
        <PredictionCard title="Hoy" data={todayPrediction} loading={todayPrediction === undefined} emptyState="not-available" featured />
        <PredictionCard title="Mañana" data={tomorrowPrediction} loading={tomorrowPrediction === undefined} emptyState={tomorrowState} closureHour={cycle.closureHour} />
      </div>

      {loadingWeather ? (
        <Card className="weather-skeleton"><Skeleton variant="card" label="Cargando pronóstico" /></Card>
      ) : weather.length > 0 ? (
        <WeatherPanel days={weather} timezone={activeSite.timezone} />
      ) : (
        <Card>
          <EmptyState icon={TrendUp} title="Pronóstico no disponible" description="El servicio meteorológico no respondió. Vuelve a actualizar en unos minutos." />
        </Card>
      )}

      <Card className="summary-note">
        <div className="summary-note__icon"><Ticket size={22} weight="duotone" aria-hidden="true" /></div>
        <div>
          <h2>Cómo se alimenta esta lectura</h2>
          <p>Las ventas de tickets son la fuente de afluencia. Al terminar la jornada, el Worker consolida el día y publica el evento que genera la predicción persistida de mañana.</p>
        </div>
        <span className="summary-note__meta"><Clock size={16} weight="duotone" aria-hidden="true" /> {cycle.registrationOpen ? 'Cierre en proceso' : 'Operación abierta'}</span>
      </Card>
    </>
  );
}
