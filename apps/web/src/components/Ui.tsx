import type { ReactNode } from 'react';
import { friendlyError } from '../api/client';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 data-route-heading tabIndex={-1}>{title}</h1><p>{description}</p></div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatusBadge({ active, activeLabel = 'Activo', inactiveLabel = 'Inactivo' }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <span className={`badge ${active ? 'badge-success' : 'badge-muted'}`}>{active ? activeLabel : inactiveLabel}</span>;
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return <div className="state-panel" role="status"><span className="spinner" />{label}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="state-panel empty"><strong>{title}</strong><span>{description}</span></div>;
}

export function ErrorNotice({ error }: { error: unknown }) {
  return <div className="notice notice-error" role="alert">{friendlyError(error)}</div>;
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return <div className="notice notice-success" role="status">{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{children}</section>;
}
