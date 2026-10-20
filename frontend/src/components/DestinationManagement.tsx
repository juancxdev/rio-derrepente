import { MapPin, Plus } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { createSite } from '../api/ticketing';
import { Alert, Badge, Button, Card, DataTable, EmptyState, Field, Input, Select } from '../design-system';
import type { Site } from '../types';

const timezones = [
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'UTC',
];

type Props = {
  tenantID: string;
  sites: Site[];
  activeSiteID: string | null;
  canManage: boolean;
  onCreated: (site: Site) => void;
  onSelect: (siteID: string) => void;
};

type FormState = { name: string; code: string; latitude: string; longitude: string; timezone: string };

const emptyForm: FormState = { name: '', code: '', latitude: '', longitude: '', timezone: 'America/Lima' };

function createSiteError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Tu rol no permite crear destinos. Pide acceso a un encargado o administrador.';
    if (error.status === 401) return 'La sesión venció. Inicia sesión nuevamente.';
    if (error.status === 409) return 'Ya existe un destino con ese código en el tenant.';
    if (error.status === 422) return error.message;
    return error.message;
  }
  return errorMessage(error, 'No se pudo crear el destino.');
}

export function DestinationManagement({ tenantID, sites, activeSiteID, canManage, onCreated, onSelect }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'El nombre es obligatorio.';
    if (!form.code.trim()) next.code = 'El código es obligatorio.';
    else if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(form.code.trim())) next.code = 'Usa minúsculas, números y guiones (2 a 50 caracteres).';
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) next.latitude = 'La latitud debe estar entre -90 y 90.';
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) next.longitude = 'La longitud debe estar entre -180 y 180.';
    if (!form.timezone.trim()) next.timezone = 'La zona horaria es obligatoria.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const site = await createSite(tenantID, {
        name: form.name.trim(),
        code: form.code.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        timezone: form.timezone,
      });
      onCreated(site);
      setForm(emptyForm);
      setStatus({ tone: 'success', message: `${site.name} quedó creado y seleccionado como destino activo.` });
    } catch (error) {
      setStatus({ tone: 'danger', message: createSiteError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="destinations-layout">
      <Card className="destinations-list">
        <div className="section-heading">
          <div>
            <h2>Destinos del tenant</h2>
            <p>Solo aparecen los destinos devueltos para tu identidad. El destino activo alimenta ventas, clima y predicciones.</p>
          </div>
          <Badge tone="neutral">{sites.length} {sites.length === 1 ? 'destino' : 'destinos'}</Badge>
        </div>
        <DataTable
          caption="Destinos del tenant autenticado"
          columns={[
            { key: 'name', header: 'Destino', render: (site) => <span className="cell-stack"><b>{site.name}</b><small>{site.code}</small></span> },
            { key: 'timezone', header: 'Zona horaria', render: (site) => <span className="mono">{site.timezone}</span> },
            { key: 'coords', header: 'Coordenadas', render: (site) => <span className="mono">{site.latitude.toFixed(3)}, {site.longitude.toFixed(3)}</span> },
            {
              key: 'state',
              header: 'Estado',
              render: (site) => site.id === activeSiteID
                ? <Badge tone="accent">Activo</Badge>
                : <Button size="sm" variant="ghost" onClick={() => onSelect(site.id)}>Usar destino</Button>,
            },
          ]}
          rows={sites}
          rowKey={(site) => site.id}
          empty={<EmptyState icon={MapPin} title="Sin destinos todavía" description="Crea el primer destino para empezar a vender tickets y consultar su predicción." />}
        />
      </Card>

      <Card className="destinations-form-card">
        <div className="section-heading">
          <div>
            <h2>Nuevo destino</h2>
            <p>El identificador lo genera el backend. Nunca se escribe un ID a mano.</p>
          </div>
        </div>
        {!canManage ? <Alert tone="warning" title="Solo lectura">Tu rol puede consultar destinos, pero no crear nuevos.</Alert> : null}
        <form className="destination-form" onSubmit={submit} noValidate>
          <Field label="Nombre" htmlFor="site-name" required error={errors.name}>
            <Input id="site-name" name="name" value={form.name} onChange={(event) => update('name', event.target.value)} invalid={Boolean(errors.name)} placeholder="Catarata del Río Derrepente" disabled={!canManage} />
          </Field>
          <Field label="Código" htmlFor="site-code" required hint="Minúsculas, números y guiones." error={errors.code}>
            <Input id="site-code" name="code" value={form.code} onChange={(event) => update('code', event.target.value)} invalid={Boolean(errors.code)} placeholder="catarata-derrepente" disabled={!canManage} />
          </Field>
          <Field label="Latitud" htmlFor="site-latitude" required error={errors.latitude}>
            <Input id="site-latitude" name="latitude" type="number" step="any" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} invalid={Boolean(errors.latitude)} placeholder="-9.295" disabled={!canManage} />
          </Field>
          <Field label="Longitud" htmlFor="site-longitude" required error={errors.longitude}>
            <Input id="site-longitude" name="longitude" type="number" step="any" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} invalid={Boolean(errors.longitude)} placeholder="-75.996" disabled={!canManage} />
          </Field>
          <Field label="Zona horaria" htmlFor="site-timezone" required error={errors.timezone}>
            <Select id="site-timezone" name="timezone" value={form.timezone} onChange={(event) => update('timezone', event.target.value)} disabled={!canManage}>
              {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </Select>
          </Field>
          <Button type="submit" icon={Plus} loading={submitting} disabled={!canManage || submitting} block>Crear destino</Button>
        </form>
        {status ? <Alert tone={status.tone} title={status.tone === 'success' ? 'Destino creado' : 'No se pudo crear'}>{status.message}</Alert> : null}
      </Card>
    </div>
  );
}
