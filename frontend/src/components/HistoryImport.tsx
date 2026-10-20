import { FileCsv, UploadSimple } from '@phosphor-icons/react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { importHistory } from '../api/ticketing';
import { Alert, Button, Card, EmptyState } from '../design-system';

type Props = {
  tenantID: string;
  siteID: string | null;
  destinationName: string;
  canManage: boolean;
};

function importError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Tu rol no permite importar históricos.';
    if (error.status === 404) return 'El destino no pertenece al tenant autenticado.';
    if (error.status === 409) return 'El día ya tiene un cierre automático; no se puede sobrescribir desde la importación.';
    if (error.status === 422) return error.message;
    return error.message;
  }
  return errorMessage(error, 'No se pudo importar el histórico.');
}

export function HistoryImport({ tenantID, siteID, destinationName, canManage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; title: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!siteID) {
    return <Card><EmptyState icon={FileCsv} title="Selecciona un destino" description="La importación histórica siempre se aplica a un destino del tenant activo." /></Card>;
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    setStatus(null);
    setFile(event.target.files?.[0] ?? null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setStatus({ tone: 'danger', title: 'Falta el archivo', message: 'Selecciona un CSV antes de importar.' });
      return;
    }
    if (!canManage) {
      setStatus({ tone: 'danger', title: 'Sin permiso', message: 'Tu rol no permite importar históricos.' });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const rows = await importHistory(tenantID, siteID!, file);
      setStatus({ tone: 'success', title: 'Histórico importado', message: `${rows} ${rows === 1 ? 'fila quedó registrada' : 'filas quedaron registradas'} para ${destinationName}.` });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      setStatus({ tone: 'danger', title: 'No se pudo importar', message: importError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="history-layout">
      <Card>
        <div className="section-heading">
          <div>
            <h2>Importar histórico del destino</h2>
            <p>El CSV reemplaza el registro del mismo día solo si ese día todavía no tiene cierre automático.</p>
          </div>
          <span className="status-pill">{destinationName}</span>
        </div>
        <form className="import-form" onSubmit={submit}>
          <label className="file-drop" htmlFor="history-file">
            <FileCsv size={26} weight="duotone" aria-hidden="true" />
            <b>{file ? file.name : 'Selecciona un archivo CSV'}</b>
            <span>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB listos para importar` : 'Columnas obligatorias: fecha y total. Opcionales: local, national y foreign.'}</span>
            <input ref={inputRef} id="history-file" name="history-file" type="file" accept=".csv,text/csv" onChange={choose} disabled={!canManage || submitting} />
          </label>
          <Button type="submit" icon={UploadSimple} loading={submitting} disabled={!canManage || submitting}>Importar histórico</Button>
        </form>
        {status ? <Alert tone={status.tone} title={status.title}>{status.message}</Alert> : null}
      </Card>

      <Card className="history-guide">
        <h2>Formato esperado</h2>
        <p>La primera fila es el encabezado. La fecha usa el formato <code>AAAA-MM-DD</code>.</p>
        <pre className="csv-sample" aria-label="Ejemplo de archivo CSV"><code>{'fecha,total,local,national,foreign\n2026-09-28,42,12,26,4\n2026-09-29,38,10,25,3'}</code></pre>
        <ul className="guide-list">
          <li>El total debe ser igual a la suma del desglose cuando se envían las tres columnas.</li>
          <li>No se aceptan valores negativos ni fechas inválidas.</li>
          <li>La importación queda marcada como histórica, no como venta de tickets.</li>
        </ul>
      </Card>
    </div>
  );
}
