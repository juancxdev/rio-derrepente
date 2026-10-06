import { FormEvent, useState } from 'react';
import { registerVisit } from '../api/visits';
import { limaDate } from '../time';

export function VisitRegistration({ enabled }: { enabled: boolean }) {
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
      await registerVisit({ visit_date: limaDate(), local_visitors: local, national_visitors: national, foreign_visitors: foreign, total_visitors: total, notes });
      setStatus('Registro recibido. La predicción de mañana se procesará en segundo plano.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo registrar la visita.');
    } finally { setBusy(false); }
  }

  if (!enabled) return <section className="register-locked"><p className="eyebrow">REGISTRO DIARIO</p><h2>Disponible desde las 18:00</h2><p>El cierre de visitas de hoy se habilita a las 18:00 (hora de Lima).</p></section>;
  return <section className="register-panel"><p className="eyebrow">REGISTRO DIARIO</p><h2>Registrar visitantes de hoy</h2><form onSubmit={submit}>
    <label>Locales<input type="number" min="0" value={local} onChange={(e) => setLocal(Number(e.target.value))} /></label>
    <label>Nacionales<input type="number" min="0" value={national} onChange={(e) => setNational(Number(e.target.value))} /></label>
    <label>Extranjeros<input type="number" min="0" value={foreign} onChange={(e) => setForeign(Number(e.target.value))} /></label>
    <label>Observaciones<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: acceso normal, lluvia por la tarde" /></label>
    <p>Total registrado: <b>{total}</b></p><button disabled={busy} type="submit">{busy ? 'Registrando…' : 'Guardar registro'}</button>
  </form>{status && <p role="status" className="form-status">{status}</p>}</section>;
}
