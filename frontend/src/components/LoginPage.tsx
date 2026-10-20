import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarCheck, Eye, EyeSlash, LockKey, Sparkle, Ticket, TrendUp } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthProvider';
import { ApiError, errorMessage } from '../api/client';
import { Alert, Button, Field, Input } from '../design-system';

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Correo o contraseña incorrectos.';
    if (error.status === 403) return 'La cuenta está desactivada o no tiene un tenant asignado.';
    return error.message;
  }
  return errorMessage(error, 'No pudimos iniciar sesión. Inténtalo nuevamente.');
}

export function LoginPage() {
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Afluencia · Acceso';
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (password.length === 0) {
      setError('Ingresa tu contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (requestError) {
      setError(loginErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-visual" aria-label="Presentación de la consola">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">AF</span>
          <div><strong>Afluencia</strong><span>Plataforma de operación turística</span></div>
        </div>
        <div className="login-visual-copy">
          <p className="login-eyebrow">Plataforma multitenant</p>
          <h1>Una sola consola para operar todos tus destinos.</h1>
          <p className="login-visual-text">Cada operador turístico administra sus propios destinos, ventas y predicciones. La plataforma mantiene separados los datos de cada tenant desde el inicio de sesión.</p>
          <ul className="login-facts">
            <li><Ticket size={20} weight="duotone" aria-hidden="true" /><span><b>Venta presencial</b>Códigos por ticket y control de duplicados.</span></li>
            <li><CalendarCheck size={20} weight="duotone" aria-hidden="true" /><span><b>Cierre por destino</b>Hora local y zona horaria de cada operador.</span></li>
            <li><TrendUp size={20} weight="duotone" aria-hidden="true" /><span><b>Predicción persistida</b>Datos del servicio ML, sin inventar cifras.</span></li>
          </ul>
        </div>
        <p className="login-visual-foot"><Sparkle size={16} weight="duotone" aria-hidden="true" /> Aislamiento por tenant en cada petición protegida.</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card-head">
            <span className="login-card-mark" aria-hidden="true"><LockKey size={20} weight="duotone" /></span>
            <h2 id="login-title">Inicia sesión</h2>
            <p>Accede con tu cuenta de plataforma u operador turístico.</p>
          </div>

          {notice ? <Alert tone="warning" title="Sesión finalizada">{notice}</Alert> : null}
          {error ? <Alert tone="danger" title="No pudimos iniciar sesión">{error}</Alert> : null}

          <form className="login-form" onSubmit={submit} noValidate>
            <Field label="Correo electrónico" htmlFor="login-email">
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="operador@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                invalid={Boolean(error)}
                autoFocus
              />
            </Field>
            <Field label="Contraseña" htmlFor="login-password">
              <div className="login-password">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  invalid={Boolean(error)}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </Field>
            <Button type="submit" block loading={submitting} icon={ArrowRight}>
              {submitting ? 'Verificando' : 'Entrar a la consola'}
            </Button>
          </form>

          <p className="login-footnote">Sesión local con token firmado y expiración. Al recargar la página se solicita un nuevo inicio de sesión.</p>
          {import.meta.env.DEV ? (
            <p className="login-demo-hint">
              No hay contraseñas por defecto. Crea o rota el acceso inicial con <code>adminctl create-superadmin</code>.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
