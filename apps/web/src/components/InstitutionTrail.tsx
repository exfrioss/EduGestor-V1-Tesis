import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import type { Institution } from '../api/types';

export function InstitutionTrail() {
  const { institutionId = '' } = useParams();
  const query = useQuery({ queryKey: ['institution', institutionId], queryFn: async () => (await apiRequest<{ institution: Institution }>(`/api/v1/institutions/${institutionId}`)).institution, enabled: Boolean(institutionId), retry: false });
  return <div className="trail"><Link to="/admin/institutions">Instituciones</Link><span>/</span><strong>{query.data?.name ?? 'Institución'}</strong></div>;
}
