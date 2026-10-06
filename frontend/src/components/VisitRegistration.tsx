import { FormEvent, useState } from 'react';
import { registerVisit } from '../api/visits';
import { limaDate } from '../time';

type Props = { enabled: boolean; onRegistered: (visitDate: string) => void };

export function VisitRegistration({ enabled, onRegistered }: Props) {
  const [local, setLocal] = useState(0);
  const [national, setNational] = useState(0);
  const [foreign, setForeign] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = local + national + foreign;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setStatus(null);
    try {
      const visitDate = limaDate();
      await registerVisit({ visit_date: visitDate, local_visitors: local, national_visitors: national, foreign_visitors: foreign, total_visitors: total, notes });
      onRegistered(visitDate);
      setStatus('Registro recibido. Estamos preparando la predicción de mañana.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo registrar la visita.');
    } finally { setBusy(false); }
  }

  if (!enabled) return <section className="register-locked"><p className="eyebrow">REGISTRO DIARIO</p><h2>Disponible desde las 18:00</h2><p>El cierre de visitas de hoy se habilita a las 18:00 (hora de Lima).</p></section>;
  return <section className="register-panel"><div className="section-heading"><div><p className="eyebrow">CIERRE OPERATIVO</p><h2>Registrar visitantes de hoy</h2><p>Este cierre activa el cálculo de la demanda estimada para mañana.</p></div><span className="status-pill">Disponible ahora</span></div><form onSubmit={submit}>
    <label>Locales<input type="number" min="0" value={local} onChange={(e) => setLocal(Number(e.target.value))} /></label>
    <label>Nacionales<input type="number" min="0" value={national} onChange={(e) => setNational(Number(e.target.value))} /></label>
    <label>Extranjeros<input type="number" min="0" value={foreign} onChange={(e) => setForeign(Number(e.target.value))} /></label>
    <label>Observaciones<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: acceso normal, lluvia por la tarde" /></label>
    <p>Total registrado: <b>{total}</b></p><button disabled={busy} type="submit">{busy ? 'Registrando…' : 'Guardar registro'}</button>
  </form>{status && <p role="status" className="form-status">{status}</p>}</section>;
}
