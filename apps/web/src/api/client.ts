import type { ApiErrorBody } from './types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? 'HTTP_ERROR',
      body.error?.message ?? 'No se pudo completar la solicitud',
      body.error?.requestId,
      body.error?.details,
    );
  }
  return body;
};

export const apiRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('edugestor:unauthorized'));
  }
  return parseResponse<T>(response);
};

export const ensureCsrfToken = async (): Promise<string> => {
  if (csrfToken !== null) return csrfToken;
  const result = await apiRequest<{ csrfToken: string }>('/api/v1/auth/csrf');
  csrfToken = result.csrfToken;
  return csrfToken;
};

export const apiMutation = async <T>(
  path: string,
  method: 'POST' | 'PATCH',
  body?: unknown,
): Promise<T> => {
  const token = await ensureCsrfToken();
  try {
    return await apiRequest<T>(path, {
      method,
      headers: { 'x-csrf-token': token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CSRF_TOKEN_INVALID') csrfToken = null;
    throw error;
  }
};

export const resetCsrfToken = (): void => {
  csrfToken = null;
};

const statusMessages: Record<number, string> = {
  401: 'Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta operación.',
  409: 'La operación entra en conflicto con datos existentes.',
  422: 'Revisa los datos ingresados e inténtalo nuevamente.',
};

export const friendlyError = (error: unknown): string => {
  if (!(error instanceof ApiError)) return 'No se pudo conectar con EduGestor.';
  const message = statusMessages[error.status] ?? error.message;
  return error.requestId ? `${message} (Solicitud ${error.requestId})` : message;
};
