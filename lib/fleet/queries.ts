'use client';

import { useQuery } from '@tanstack/react-query';
import type { ActivityResponse, OrgResponse, PresenceResponse } from './web-contract';

/**
 * The ONLY place the screens read Fleet data from.
 *
 * Every call goes to this zone's own server routes (/fleet/api/fleet/*), which
 * check the session, call the Fleet service and return only contract fields.
 * The browser never calls the Fleet service and never holds its token.
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** A failed Fleet request, carrying the service's own FLEET_ code. */
export class FleetApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/fleet/${path}`, { cache: 'no-store', credentials: 'same-origin' });
  } catch {
    throw new FleetApiError('FLEET_NETWORK', 0);
  }
  if (!res.ok) {
    let code = `FLEET_HTTP_${res.status}`;
    try {
      const body = (await res.json()) as { code?: unknown };
      if (typeof body?.code === 'string') code = body.code;
    } catch {
      /* no JSON body */
    }
    throw new FleetApiError(code, res.status);
  }
  return (await res.json()) as T;
}

export function useOrg() {
  return useQuery({
    queryKey: ['fleet', 'org'],
    queryFn: () => getJson<OrgResponse>('org'),
    staleTime: 60_000,
    retry: false,
  });
}

export function usePresence() {
  return useQuery({
    queryKey: ['fleet', 'presence'],
    queryFn: () => getJson<PresenceResponse>('presence'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useActivity(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['fleet', 'activity', from, to],
    queryFn: () => getJson<ActivityResponse>(`activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    enabled: enabled && Boolean(from && to),
    staleTime: 60_000,
    retry: false,
  });
}

/** The code to show for a failed query. */
export function errorCode(error: unknown): string {
  return error instanceof FleetApiError ? error.code : 'FLEET_CLIENT_ERROR';
}
