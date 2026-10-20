import {
  ArrowClockwise,
  Buildings,
  CaretLeft,
  CaretRight,
  List,
  MapPin,
  Plus,
  ShieldCheck,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  createPlatformAccount,
  createPlatformSite,
  createPlatformTenant,
  listPlatformAccounts,
  listPlatformSites,
  listPlatformTenants,
} from '../api/platform';
import { ApiError, errorMessage } from '../api/client';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  Metric,
  PageHeader,
  Select,
  Skeleton,
} from '../design-system';
import { UserMenu } from '../components/UserMenu';
import { useTenant } from '../tenant/TenantContext';
import type { PlatformAccount, PlatformTenant, Role, Site } from '../types';

type Tab = 'operators' | 'sites' | 'accounts';

const tabs: Array<{ id: Tab; label: string; icon: typeof Buildings }> = [
  { id: 'operators', label: 'Operadores', icon: Buildings },
  { id: 'sites', label: 'Destinos', icon: MapPin },
  { id: 'accounts', label: 'Cuentas', icon: UsersThree },
];

const timezones = [
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'UTC',
];

type TenantForm = { name: string };
type SiteForm = { tenantID: string; name: string; code: string; latitude: string; longitude: string; timezone: string };
type AccountForm = { email: string; display_name: string; password: string; tenant_id: string; role: Role };

function platformError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'La sesión venció. Inicia sesión nuevamente.';
    if (error.status === 403) return 'Solo el super administrador puede realizar esta operación.';
    if (error.status === 404) return 'El operador o recurso ya no existe.';
    if (error.status === 409) return 'Ese código de destino ya existe en el operador.';
    if (error.status === 422) return error.message;
    return error.message;
  }
  return errorMessage(error, fallback);
}

function PlatformShell({ tab, onTab, children }: { tab: Tab; onTab: (tab: Tab) => void; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.title = 'Consola de plataforma · Afluencia';
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 980) setDrawerOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  function navigate(next: Tab) {
    onTab(next);
    setDrawerOpen(false);
  }

  return (
    <main className={`app-shell ${drawerOpen ? 'drawer-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`.trim()}>
      <a className="skip-link" href="#platform-content">Saltar al contenido</a>
      <button className="mobile-menu" type="button" aria-label="Abrir navegación" aria-controls="platform-sidebar" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
        <List size={22} aria-hidden="true" />
      </button>
      <button className="drawer-scrim" type="button" aria-label="Cerrar navegación" onClick={() => setDrawerOpen(false)} />
      <div className="app-layout">
        <aside className="sidebar" id="platform-sidebar" aria-label="Navegación de plataforma">
          <div className="sidebar-top">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">AF</span>
              <div><b>Afluencia</b><span>Consola de plataforma</span></div>
            </div>
            <button
              className="brand-toggle"
              type="button"
              aria-label="Mostrar menú lateral"
              title="Mostrar menú lateral"
              onClick={() => setSidebarCollapsed(false)}
            >
              <span className="brand-mark" aria-hidden="true">AF</span>
              <CaretRight size={14} aria-hidden="true" />
            </button>
            <button
              className="sidebar-collapse"
              type="button"
              aria-label="Ocultar menú lateral"
              title="Ocultar menú lateral"
              onClick={() => setSidebarCollapsed(true)}
            >
              <CaretLeft size={20} aria-hidden="true" />
            </button>
            <button ref={closeButtonRef} className="sidebar-close" type="button" aria-label="Cerrar navegación" onClick={() => setDrawerOpen(false)}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="platform-badge">
            <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
            <span>Super administrador</span>
          </div>

          <nav className="sidebar-nav" aria-label="Secciones de plataforma">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={tab === id ? 'active' : ''} aria-label={label} aria-current={tab === id ? 'page' : undefined} data-tooltip={label} onClick={() => navigate(id)}>
                <Icon size={19} weight={tab === id ? 'fill' : 'regular'} aria-hidden="true" />
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-status">
            <span className="sidebar-status__dot" aria-hidden="true" />
            <span>Acceso global a todos los operadores</span>
          </div>
          <UserMenu />
        </aside>

        <section className="workspace" id="platform-content" aria-label="Consola de plataforma">
          <div className="workspace-topbar">
            <p className="workspace-topbar__site"><ShieldCheck size={16} weight="duotone" aria-hidden="true" /> Plataforma</p>
            <span className="time-pill">Multitenant</span>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

export function PlatformConsole() {
  const { role } = useTenant();
  const [tab, setTab] = useState<Tab>('operators');
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedTenantID, setSelectedTenantID] = useState('');
  const [loading, setLoading] = useState(true);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantID) ?? null;

  async function loadBase() {
    setLoading(true);
    setError(null);
    try {
      const [tenantList, accountList] = await Promise.all([listPlatformTenants(), listPlatformAccounts()]);
      setTenants(tenantList);
      setAccounts(accountList);
      setSelectedTenantID((current) => (current && tenantList.some((tenant) => tenant.id === current) ? current : tenantList[0]?.id ?? ''));
    } catch (requestError) {
      setError(platformError(requestError, 'No pudimos cargar la consola de plataforma.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadSites(tenantID: string) {
    if (!tenantID) {
      setSites([]);
      return;
    }
    setSitesLoading(true);
    try {
      setSites(await listPlatformSites(tenantID));
    } catch (requestError) {
      setError(platformError(requestError, 'No pudimos cargar los destinos del operador.'));
    } finally {
      setSitesLoading(false);
    }
  }

  useEffect(() => { void loadBase(); }, []);
  useEffect(() => { void loadSites(selectedTenantID); }, [selectedTenantID]);

  return (
    <PlatformShell tab={tab} onTab={setTab}>
      <PageHeader
        eyebrow="Administración de plataforma"
        title={tab === 'operators' ? 'Operadores' : tab === 'sites' ? 'Destinos' : 'Cuentas'}
        description={
          tab === 'operators'
            ? 'Crea y revisa los operadores turísticos de la plataforma.'
            : tab === 'sites'
              ? 'Cada destino pertenece a un operador y se usa para ventas, clima y predicciones.'
              : 'Crea la cuenta de acceso para el administrador o el equipo de cada operador.'
        }
        actions={<Button variant="secondary" icon={ArrowClockwise} onClick={() => { setNotice(null); void loadBase(); }} loading={loading}>Actualizar</Button>}
      />

      {error ? <Alert tone="danger" title="No pudimos completar la operación" action={<Button size="sm" variant="secondary" onClick={() => { setError(null); void loadBase(); }}>Reintentar</Button>}>{error}</Alert> : null}
      {notice ? <Alert tone="success" title="Operación completada">{notice}</Alert> : null}

      {loading ? (
        <div className="metric-row">
          <Skeleton variant="card" label="Cargando operadores" />
          <Skeleton variant="card" label="Cargando destinos" />
          <Skeleton variant="card" label="Cargando cuentas" />
        </div>
      ) : (
        <>
          <div className="metric-row">
            <Metric label="Operadores" value={tenants.length} hint="Tenants registrados" tone="accent" />
            <Metric label="Destinos" value={tenants.reduce((total, tenant) => total + tenant.sites, 0)} hint="En todos los operadores" />
            <Metric label="Cuentas" value={accounts.length} hint="Incluye al super administrador" />
          </div>

          {tab === 'operators' ? <OperatorsPanel tenants={tenants} loading={loading} onReload={loadBase} onSelect={(id) => { setSelectedTenantID(id); setTab('sites'); }} onNotice={setNotice} /> : null}
          {tab === 'sites' ? <SitesPanel tenants={tenants} selectedTenantID={selectedTenantID} onSelectTenant={setSelectedTenantID} sites={sites} loading={sitesLoading} onReload={async () => { await loadSites(selectedTenantID); await loadBase(); }} onNotice={setNotice} /> : null}
          {tab === 'accounts' ? <AccountsPanel tenants={tenants} accounts={accounts} onReload={loadBase} onNotice={setNotice} /> : null}
        </>
      )}

      <p className="platform-footnote">Sesión de plataforma con rol <strong>{role ?? 'super_admin'}</strong>. Los datos de cada operador permanecen aislados por tenant.</p>
    </PlatformShell>
  );
}

function OperatorsPanel({ tenants, loading, onReload, onSelect, onNotice }: { tenants: PlatformTenant[]; loading: boolean; onReload: () => Promise<void>; onSelect: (id: string) => void; onNotice: (message: string) => void }) {
  const [form, setForm] = useState<TenantForm>({ name: '' });
  const [validation, setValidation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidation(null);
    if (!form.name.trim()) {
      setValidation('El nombre del operador es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      const tenant = await createPlatformTenant(form.name.trim());
      setForm({ name: '' });
      onNotice(`Operador ${tenant.name} creado. Ahora puedes agregar sus destinos y cuentas.`);
      await onReload();
      onSelect(tenant.id);
    } catch (requestError) {
      setError(platformError(requestError, 'No pudimos crear el operador.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="platform-grid">
      <Card>
        <div className="section-heading">
          <div><h2>Operadores turísticos</h2><p>Cada operador es un tenant con sus propios destinos y cuentas.</p></div>
          <Badge tone="accent">{tenants.length} {tenants.length === 1 ? 'operador' : 'operadores'}</Badge>
        </div>
        <DataTable
          caption="Operadores turísticos de la plataforma"
          columns={[
            { key: 'name', header: 'Operador', render: (tenant) => <span className="cell-stack"><b>{tenant.name}</b><small>{tenant.id}</small></span> },
            { key: 'sites', header: 'Destinos', align: 'end', render: (tenant) => tenant.sites },
            { key: 'accounts', header: 'Cuentas', align: 'end', render: (tenant) => tenant.accounts },
            { key: 'actions', header: '', render: (tenant) => <Button size="sm" variant="ghost" onClick={() => onSelect(tenant.id)}>Ver destinos</Button> },
          ]}
          rows={tenants}
          rowKey={(tenant) => tenant.id}
          empty={<EmptyState icon={Buildings} title="Sin operadores todavía" description="Crea el primer operador para habilitar sus destinos y cuentas." />}
        />
        {loading ? <Skeleton variant="text" label="Actualizando operadores" /> : null}
      </Card>

      <Card>
        <div className="section-heading"><div><h2>Nuevo operador</h2><p>El identificador se genera automáticamente.</p></div></div>
        <form className="destination-form" onSubmit={submit} noValidate>
          <Field label="Nombre del operador" htmlFor="platform-tenant-name" required error={validation}>
            <Input id="platform-tenant-name" value={form.name} placeholder="Operador turístico del valle" invalid={Boolean(validation)} onChange={(event) => setForm({ name: event.target.value })} />
          </Field>
          <Button type="submit" icon={Plus} loading={submitting} block>Crear operador</Button>
        </form>
        {error ? <Alert tone="danger" title="No se pudo crear">{error}</Alert> : null}
      </Card>
    </div>
  );
}

function SitesPanel({ tenants, selectedTenantID, onSelectTenant, sites, loading, onReload, onNotice }: { tenants: PlatformTenant[]; selectedTenantID: string; onSelectTenant: (id: string) => void; sites: Site[]; loading: boolean; onReload: () => Promise<void>; onNotice: (message: string) => void }) {
  const [form, setForm] = useState<Omit<SiteForm, 'tenantID'>>({ name: '', code: '', latitude: '', longitude: '', timezone: 'America/Lima' });
  const [errors, setErrors] = useState<Partial<Record<'name' | 'code' | 'latitude' | 'longitude', string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const tenant = tenants.find((item) => item.id === selectedTenantID);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const next: typeof errors = {};
    if (!selectedTenantID) next.name = 'Selecciona un operador.';
    if (!form.name.trim()) next.name = 'El nombre del destino es obligatorio.';
    if (!form.code.trim()) next.code = 'El código es obligatorio.';
    else if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(form.code.trim())) next.code = 'Usa minúsculas, números y guiones (2 a 50 caracteres).';
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) next.latitude = 'La latitud debe estar entre -90 y 90.';
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) next.longitude = 'La longitud debe estar entre -180 y 180.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      const site = await createPlatformSite(selectedTenantID, {
        name: form.name.trim(),
        code: form.code.trim(),
        latitude,
        longitude,
        timezone: form.timezone,
      });
      setForm({ name: '', code: '', latitude: '', longitude: '', timezone: 'America/Lima' });
      onNotice(`${site.name} quedó creado para ${tenant?.name ?? 'el operador'}.`);
      await onReload();
    } catch (requestError) {
      setError(platformError(requestError, 'No pudimos crear el destino.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (tenants.length === 0) {
    return <Card><EmptyState icon={Buildings} title="Primero crea un operador" description="Los destinos siempre pertenecen a un operador turístico." /></Card>;
  }

  return (
    <div className="platform-grid">
      <Card>
        <div className="section-heading">
          <div><h2>Destinos del operador</h2><p>Selecciona un operador para revisar o crear sus destinos.</p></div>
          <Badge tone="neutral">{sites.length} {sites.length === 1 ? 'destino' : 'destinos'}</Badge>
        </div>
        <Field label="Operador" htmlFor="platform-site-tenant">
          <Select id="platform-site-tenant" value={selectedTenantID} onChange={(event) => onSelectTenant(event.target.value)}>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </Select>
        </Field>
        {loading ? <Skeleton variant="card" label="Cargando destinos" /> : (
          <DataTable
            caption="Destinos del operador seleccionado"
            columns={[
              { key: 'name', header: 'Destino', render: (site) => <span className="cell-stack"><b>{site.name}</b><small>{site.code}</small></span> },
              { key: 'timezone', header: 'Zona horaria', render: (site) => <span className="mono">{site.timezone}</span> },
              { key: 'coords', header: 'Coordenadas', render: (site) => <span className="mono">{site.latitude.toFixed(3)}, {site.longitude.toFixed(3)}</span> },
            ]}
            rows={sites}
            rowKey={(site) => site.id}
            empty={<EmptyState icon={MapPin} title="Sin destinos todavía" description="Crea el primer destino de este operador para habilitar ventas y predicciones." />}
          />
        )}
      </Card>

      <Card>
        <div className="section-heading"><div><h2>Nuevo destino</h2><p>Se agrega solo al operador seleccionado.</p></div></div>
        <form className="destination-form" onSubmit={submit} noValidate>
          <Field label="Nombre" htmlFor="platform-site-name" required error={errors.name}>
            <Input id="platform-site-name" value={form.name} placeholder="Catarata del valle" invalid={Boolean(errors.name)} onChange={(event) => update('name', event.target.value)} />
          </Field>
          <Field label="Código" htmlFor="platform-site-code" required hint="Minúsculas, números y guiones." error={errors.code}>
            <Input id="platform-site-code" value={form.code} placeholder="catarata-valle" invalid={Boolean(errors.code)} onChange={(event) => update('code', event.target.value)} />
          </Field>
          <Field label="Latitud" htmlFor="platform-site-latitude" required error={errors.latitude}>
            <Input id="platform-site-latitude" type="number" step="any" value={form.latitude} placeholder="-9.295" invalid={Boolean(errors.latitude)} onChange={(event) => update('latitude', event.target.value)} />
          </Field>
          <Field label="Longitud" htmlFor="platform-site-longitude" required error={errors.longitude}>
            <Input id="platform-site-longitude" type="number" step="any" value={form.longitude} placeholder="-75.996" invalid={Boolean(errors.longitude)} onChange={(event) => update('longitude', event.target.value)} />
          </Field>
          <Field label="Zona horaria" htmlFor="platform-site-timezone" required>
            <Select id="platform-site-timezone" value={form.timezone} onChange={(event) => update('timezone', event.target.value)}>
              {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </Select>
          </Field>
          <Button type="submit" icon={Plus} loading={submitting || loading} disabled={!selectedTenantID} block>Crear destino</Button>
        </form>
        {error ? <Alert tone="danger" title="No se pudo crear">{error}</Alert> : null}
      </Card>
    </div>
  );
}

function AccountsPanel({ tenants, accounts, onReload, onNotice }: { tenants: PlatformTenant[]; accounts: PlatformAccount[]; onReload: () => Promise<void>; onNotice: (message: string) => void }) {
  const [form, setForm] = useState<AccountForm>({ email: '', display_name: '', password: '', tenant_id: '', role: 'admin' });
  const [errors, setErrors] = useState<Partial<Record<keyof AccountForm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((current) => (current.tenant_id || tenants.length === 0 ? current : { ...current, tenant_id: tenants[0].id }));
  }, [tenants]);

  function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Ingresa un correo válido.';
    if (!form.display_name.trim()) next.display_name = 'El nombre es obligatorio.';
    if (form.password.length < 8) next.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (!form.tenant_id) next.tenant_id = 'Selecciona un operador.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      const account = await createPlatformAccount({
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        password: form.password,
        tenant_id: form.tenant_id,
        role: form.role as Exclude<Role, 'super_admin'>,
      });
      setForm((current) => ({ ...current, email: '', display_name: '', password: '' }));
      onNotice(`Cuenta ${account.email} creada para ${account.tenant_name}.`);
      await onReload();
    } catch (requestError) {
      setError(platformError(requestError, 'No pudimos crear la cuenta.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="platform-grid">
      <Card>
        <div className="section-heading">
          <div><h2>Cuentas de la plataforma</h2><p>El super administrador no pertenece a un operador; las demás cuentas sí.</p></div>
          <Badge tone="neutral">{accounts.length} cuentas</Badge>
        </div>
        <DataTable
          caption="Cuentas de la plataforma"
          columns={[
            { key: 'email', header: 'Cuenta', render: (account) => <span className="cell-stack"><b>{account.display_name}</b><small>{account.email}</small></span> },
            { key: 'tenant', header: 'Operador', render: (account) => account.is_super_admin ? <Badge tone="accent">Plataforma</Badge> : account.tenant_name },
            { key: 'role', header: 'Rol', render: (account) => account.is_super_admin ? <Badge tone="accent">Super administrador</Badge> : <Badge tone="neutral">{account.role}</Badge> },
            { key: 'active', header: 'Estado', render: (account) => <Badge tone={account.active ? 'success' : 'danger'}>{account.active ? 'Activa' : 'Inactiva'}</Badge> },
          ]}
          rows={accounts}
          rowKey={(account) => `${account.user_id}-${account.tenant_id ?? 'platform'}`}
          empty={<EmptyState icon={UsersThree} title="Sin cuentas todavía" description="Crea la primera cuenta de administrador para un operador." />}
        />
      </Card>

      <Card>
        <div className="section-heading"><div><h2>Nueva cuenta</h2><p>La contraseña se guarda hasheada y no se vuelve a mostrar.</p></div></div>
        {tenants.length === 0 ? <Alert tone="warning" title="Primero crea un operador">Las cuentas de tenant necesitan un operador al cual pertenecer.</Alert> : null}
        <form className="destination-form" onSubmit={submit} noValidate>
          <Field label="Correo electrónico" htmlFor="platform-account-email" required error={errors.email}>
            <Input id="platform-account-email" type="email" autoComplete="off" value={form.email} placeholder="admin@operador.com" invalid={Boolean(errors.email)} onChange={(event) => update('email', event.target.value)} disabled={tenants.length === 0} />
          </Field>
          <Field label="Nombre visible" htmlFor="platform-account-name" required error={errors.display_name}>
            <Input id="platform-account-name" value={form.display_name} placeholder="Administrador del operador" invalid={Boolean(errors.display_name)} onChange={(event) => update('display_name', event.target.value)} disabled={tenants.length === 0} />
          </Field>
          <Field label="Contraseña inicial" htmlFor="platform-account-password" required hint="Mínimo 8 caracteres." error={errors.password}>
            <Input id="platform-account-password" type="password" autoComplete="new-password" value={form.password} invalid={Boolean(errors.password)} onChange={(event) => update('password', event.target.value)} disabled={tenants.length === 0} />
          </Field>
          <Field label="Operador" htmlFor="platform-account-tenant" required error={errors.tenant_id}>
            <Select id="platform-account-tenant" value={form.tenant_id} onChange={(event) => update('tenant_id', event.target.value)} disabled={tenants.length === 0}>
              {tenants.length === 0 ? <option value="">Sin operadores</option> : null}
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </Select>
          </Field>
          <Field label="Rol" htmlFor="platform-account-role" required>
            <Select id="platform-account-role" value={form.role} onChange={(event) => update('role', event.target.value as Role)} disabled={tenants.length === 0}>
              <option value="admin">Administrador</option>
              <option value="manager">Encargado</option>
              <option value="operator">Operador</option>
            </Select>
          </Field>
          <Button type="submit" icon={Plus} loading={submitting} disabled={tenants.length === 0} block>Crear cuenta</Button>
        </form>
        {error ? <Alert tone="danger" title="No se pudo crear">{error}</Alert> : null}
      </Card>
    </div>
  );
}
