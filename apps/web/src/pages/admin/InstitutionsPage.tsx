import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiMutation, apiRequest } from '../../api/client';
import type { Institution } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PermissionGate } from '../../auth/PermissionGate';
import { EmptyState, ErrorNotice, Field, LoadingState, PageHeader, StatusBadge, SuccessNotice } from '../../components/Ui';

export function InstitutionsPage() {
  const auth = useAuth(); const client = useQueryClient(); const [success, setSuccess] = useState('');
  const institutions = useQuery({ queryKey: ['institutions'], queryFn: async () => (await apiRequest<{ institutions: Institution[] }>('/api/v1/institutions')).institutions, retry: false });
  const refresh = () => client.invalidateQueries({ queryKey: ['institutions'] });
  const create = useMutation({ mutationFn: (body: { name: string; technicalReason: string }) => apiMutation('/api/v1/institutions', 'POST', body), onSuccess: () => { setSuccess('Institución creada.'); void refresh(); } });
  const update = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => apiMutation(`/api/v1/institutions/${id}`, 'PATCH', { name }), onSuccess: () => { setSuccess('Institución actualizada.'); void refresh(); } });
  const state = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => apiMutation(`/api/v1/institutions/${id}/${active ? 'reactivate' : 'deactivate'}`, 'POST'), onSuccess: () => { setSuccess('Estado actualizado.'); void refresh(); } });
  const submitCreate = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); create.mutate({ name: String(data.get('name')), technicalReason: String(data.get('technicalReason')) }, { onSuccess: () => form.reset() }); };

  return <>
    <PageHeader eyebrow="Paso 1 de 5" title="Instituciones" description="Selecciona una institución para continuar el recorrido administrativo." />
    {success && <SuccessNotice>{success}</SuccessNotice>}
    {auth.user?.accountKind === 'TECHNICAL' && <section className="panel accent-panel"><div className="panel-heading"><div><h2>Nueva institución</h2><p>Operación reservada a la cuenta técnica y siempre auditada.</p></div></div><form className="form-grid" onSubmit={submitCreate}><Field label="Nombre"><input name="name" required maxLength={200} /></Field><Field label="Motivo técnico"><input name="technicalReason" required maxLength={1000} /></Field><button className="button primary" disabled={create.isPending}>Crear institución</button></form>{create.error && <ErrorNotice error={create.error} />}</section>}
    {institutions.isLoading && <LoadingState label="Cargando instituciones…" />}
    {institutions.error && <ErrorNotice error={institutions.error} />}
    {institutions.data?.length === 0 && <EmptyState title="Sin instituciones disponibles" description="No tienes una institución dentro de tu ámbito o todavía no fue creada." />}
    <div className="card-grid">{institutions.data?.map((item) => <article className="entity-card" key={item.id}><div className="entity-card-top"><div><h2>{item.name}</h2><p>ID {item.id.slice(0, 8)}</p></div><StatusBadge active={item.isActive} /></div><div className="card-actions"><Link className="button primary" to={`/admin/institutions/${item.id}/teachers`}>Administrar</Link><PermissionGate permission="institution.manage" resourceType="institution" resourceId={item.id}><details className="inline-editor"><summary className="button secondary">Editar</summary><form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; update.mutate({ id: item.id, name: String(new FormData(form).get('name')) }); }}><Field label="Nombre"><input name="name" defaultValue={item.name} required /></Field><button className="button small" disabled={update.isPending}>Guardar</button></form></details><button className={`button ${item.isActive ? 'danger-ghost' : 'secondary'}`} onClick={() => { if (window.confirm(item.isActive ? `¿Desactivar ${item.name}?` : `¿Reactivar ${item.name}?`)) state.mutate({ id: item.id, active: !item.isActive }); }}>{item.isActive ? 'Desactivar' : 'Reactivar'}</button></PermissionGate></div></article>)}</div>
    {(update.error || state.error) && <ErrorNotice error={update.error ?? state.error} />}
  </>;
}
