import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: PhosphorIcon;
  block?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  block = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`ds-button ds-button--${variant} ds-button--${size} ${block ? 'ds-button--block' : ''} ${className}`.trim()}
    >
      {loading ? <Spinner size={16} label="" /> : Icon ? <Icon size={size === 'sm' ? 16 : 18} weight="bold" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={`ds-field ${className}`.trim()}>
      <label className="ds-field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="ds-field__hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="ds-field__error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

type InputProps = ComponentPropsWithoutRef<'input'> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', invalid = false, ...rest },
  ref,
) {
  return <input ref={ref} {...rest} aria-invalid={invalid || undefined} className={`ds-control ${invalid ? 'is-invalid' : ''} ${className}`.trim()} />;
});

type SelectProps = ComponentPropsWithoutRef<'select'> & { invalid?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', invalid = false, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} {...rest} aria-invalid={invalid || undefined} className={`ds-control ds-control--select ${invalid ? 'is-invalid' : ''} ${className}`.trim()}>
      {children}
    </select>
  );
});

type TextareaProps = ComponentPropsWithoutRef<'textarea'> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', invalid = false, ...rest },
  ref,
) {
  return <textarea ref={ref} {...rest} aria-invalid={invalid || undefined} className={`ds-control ds-control--textarea ${invalid ? 'is-invalid' : ''} ${className}`.trim()} />;
});

export function Card({ className = '', children, as: Tag = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={`ds-card ${className}`.trim()}>{children}</Tag>;
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`ds-badge ds-badge--${tone} ${className}`.trim()}>{children}</span>;
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  live = 'polite',
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  live?: 'polite' | 'assertive' | 'off';
}) {
  return (
    <div className={`ds-alert ds-alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'} aria-live={live}>
      <div className="ds-alert__body">
        {title ? <strong className="ds-alert__title">{title}</strong> : null}
        {children ? <div className="ds-alert__text">{children}</div> : null}
      </div>
      {action ? <div className="ds-alert__action">{action}</div> : null}
    </div>
  );
}

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'start' | 'end';
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.align === 'end' ? 'is-end' : undefined}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'end' ? 'is-end' : undefined}>
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Skeleton({ variant = 'block', label = 'Cargando' }: { variant?: 'block' | 'text' | 'card'; label?: string }) {
  return (
    <div className={`ds-skeleton ds-skeleton--${variant}`} aria-busy="true">
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: PhosphorIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="ds-empty">
      {Icon ? <span className="ds-empty__icon"><Icon size={24} weight="duotone" aria-hidden="true" /></span> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="ds-empty__action">{action}</div> : null}
    </div>
  );
}

export function Spinner({ size = 18, label = 'Cargando' }: { size?: number; label?: string }) {
  return (
    <span className="ds-spinner" style={{ width: size, height: size }} role={label ? 'status' : undefined} aria-hidden={label ? undefined : true}>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export function Metric({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: string; tone?: 'neutral' | 'accent' | 'warning' }) {
  return (
    <div className={`ds-metric ds-metric--${tone}`}>
      <span className="ds-metric__label">{label}</span>
      <strong className="ds-metric__value">{value}</strong>
      {hint ? <span className="ds-metric__hint">{hint}</span> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  const titleId = useId();
  return (
    <header className="ds-page-header" aria-labelledby={titleId}>
      <div>
        {eyebrow ? <p className="ds-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId}>{title}</h1>
        {description ? <p className="ds-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ds-page-header__actions">{actions}</div> : null}
    </header>
  );
}
