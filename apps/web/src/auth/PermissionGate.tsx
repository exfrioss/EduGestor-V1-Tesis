import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError, apiRequest } from '../api/client';

export function PermissionGate({
  permission,
  resourceType,
  resourceId,
  children,
  fallback = null,
}: {
  permission: string;
  resourceType: 'institution' | 'course' | 'teaching-assignment';
  resourceId: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const check = useQuery({
    queryKey: ['permission', permission, resourceType, resourceId],
    queryFn: async () => {
      try {
        const result = await apiRequest<{ authorized: true }>(
          `/api/v1/authorization/check/${resourceType}/${resourceId}/${permission}`,
        );
        return result.authorized;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
        throw error;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
  return check.data === true ? children : fallback;
}
