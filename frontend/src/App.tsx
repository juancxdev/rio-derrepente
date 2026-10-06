import { useEffect, useState } from 'react';
import { getPrediction } from './api/predictions';
import { getWeatherForecast } from './api/weather';
import { PredictionCard } from './components/PredictionCard';
import { VisitRegistration } from './components/VisitRegistration';
import { WeatherPanel } from './components/WeatherPanel';
import { isRegistrationOpen, limaDate } from './time';
import type { Prediction, WeatherForecast } from './types';

export default function App() {
  const [predictions, setPredictions] = useState<(Prediction | null | undefined)[]>([]);
  const [weather, setWeather] = useState<WeatherForecast[]>([]);
  const [error, setError] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(isRegistrationOpen());

  async function load() {
    setError(false); setPredictions([]);
    try {
      const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      const [items, forecast] = await Promise.all([
        Promise.all([getPrediction(limaDate(today)), getPrediction(limaDate(tomorrow))]),
        getWeatherForecast(),
      ]);
      setPredictions(items); setWeather(forecast.days);
    } catch { setError(true); }
  }

  useEffect(() => { load(); const timer = window.setInterval(() => setRegistrationOpen(isRegistrationOpen()), 60_000); return () => window.clearInterval(timer); }, []);

  return <main>
    <header><p className="eyebrow">TINGO MARÍA · CATARATA DEL RÍO DERREPENTE</p><h1>Demanda turística prevista</h1><p>Información para encargados y comercios cercanos.</p></header>
    {error ? <section className="notice" role="alert">No pudimos obtener la información. <button onClick={load}>Reintentar</button></section> : <>
      <div className="grid"><PredictionCard title="Hoy" data={predictions[0]} loading={!predictions.length} /><PredictionCard title="Mañana" data={predictions[1]} loading={!predictions.length} /></div>
      {weather.length > 0 && <WeatherPanel days={weather} />}
    </>}
    <VisitRegistration enabled={registrationOpen} />
    <footer>Estimación generada por el modelo <b>baseline-1.0</b>. El pronóstico mostrado proviene de Open-Meteo y no sustituye los datos climáticos capturados por el backend.</footer>
  </main>;
}
