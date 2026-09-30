import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { FLEET_READ_PERMISSION } from '../access';
import { MAX_ACTIVITY_SPAN_DAYS } from '../web-contract';
import type {
  ActivityResponse,
  ActivityRow,
  Agent,
  Lookup,
  OrgResponse,
  PresenceEntry,
  PresenceResponse,
} from '../web-contract';

/**
 * SERVER-ONLY. The single implementation behind the zone's Fleet data routes
 * (app/api/fleet/{org,presence,activity}/route.ts, which only re-export GET).
 *
 * What it guarantees, in order, for every request:
 *  1. It RE-CHECKS the session itself, so a middleware matcher mistake cannot
 *     open data: a verified NextAuth JWT, a live Auth access token, and the
 *     Fleet read permission. Otherwise 401 or 403, and nothing is forwarded.
 *  2. It calls ONE fixed upstream path per route (an allow-list, never a
 *     catch-all), with GET only and no request body. Query parameters are
 *     rebuilt from a typed parse, never passed through.
 *  3. The human's Auth token travels server-to-server as a Bearer header. It is
 *     never written to a response or a log line.
 *  4. The upstream body is validated against the v1 contract and copied field
 *     by field. Anything outside the contract is dropped; a body that does not
 *     match is refused (502), never forwarded.
 *  5. An upstream error surfaces as its own `FLEET_...` code, on screen and in
 *     one server log line, so a signed-in failure names its cause.
 */

export type WebRoute = 'org' | 'presence' | 'activity';

const UPSTREAM_PATH: Record<WebRoute, string> = {
  org: '/api/web/org',
  presence: '/api/web/presence',
  activity: '/api/web/activity',
};

const UPSTREAM_TIMEOUT_MS = 15_000;
const FLEET_CODE = /^FLEET_[A-Z0-9_]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE = { 'Cache-Control': 'no-store' };

function reply(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function refuse(status: number, code: string): NextResponse {
  return reply(status, { code });
}

function log(route: WebRoute, status: number, code: string): void {
  // Route, status and code only. Never the token, never a body.
  console.error(`[fleet-web] ${route} -> ${status} ${code}`);
}

// ── 1. The session re-check ─────────────────────────────────────────────────

type Authorised = { accessToken: string };

function expired(tokenExpires: unknown, now: number): boolean {
  if (typeof tokenExpires !== 'string') return false;
  const at = Date.parse(tokenExpires);
  return Number.isFinite(at) && at <= now;
}

async function authorise(req: NextRequest): Promise<Authorised | NextResponse> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return reply(401, { code: 'FLEET_SESSION_MISSING', message: 'Unauthorized' });

  let token: Awaited<ReturnType<typeof getToken>> = null;
  try {
    // Verifies the signature: a cookie signed with any other secret decodes to null.
    token = await getToken({ req, secret });
  } catch {
    token = null;
  }
  const accessToken = token && typeof token.accessToken === 'string' ? token.accessToken : '';
  if (!token || !accessToken || expired(token.tokenExpires, Date.now())) {
    return reply(401, { code: 'FLEET_SESSION_MISSING', message: 'Unauthorized' });
  }
  const permissions = Array.isArray(token.permissions) ? token.permissions : [];
  if (!permissions.includes(FLEET_READ_PERMISSION)) return refuse(403, 'FLEET_NO_READ');

  return { accessToken };
}

// ── 2. The activity range, parsed and rebuilt ───────────────────────────────

function parseDay(value: string | null): number | null {
  if (!value || !DAY.test(value)) return null;
  const at = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(at)) return null;
  // Rejects dates that roll over, such as 2026-02-30.
  return new Date(at).toISOString().slice(0, 10) === value ? at : null;
}

function activityQuery(req: NextRequest): string | null {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const a = parseDay(from);
  const b = parseDay(to);
  if (a === null || b === null || a > b) return null;
  if ((b - a) / 86_400_000 > MAX_ACTIVITY_SPAN_DAYS) return null;
  return `?from=${from}&to=${to}`;
}

// ── 4. Contract validation: copy known fields, refuse anything malformed ────

class BadResponse extends Error {}

function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadResponse();
  return v as Record<string, unknown>;
}
function arr(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new BadResponse();
  return v;
}
function str(v: unknown): string {
  if (typeof v !== 'string') throw new BadResponse();
  return v;
}
function int(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new BadResponse();
  return v;
}
function bool(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new BadResponse();
  return v;
}
function uuid(v: unknown): string {
  const s = str(v);
  if (!UUID.test(s)) throw new BadResponse();
  return s;
}
function nullable<T>(v: unknown, read: (x: unknown) => T): T | null {
  return v === null || v === undefined ? null : read(v);
}

function lookup(v: unknown): Lookup {
  const o = obj(v);
  return { id: int(o.id), name: str(o.name), isActive: bool(o.isActive) };
}

function agent(v: unknown): Agent {
  const o = obj(v);
  return {
    agentId: uuid(o.agentId),
    firstName: str(o.firstName),
    lastName: str(o.lastName),
    roleId: int(o.roleId),
    departmentId: int(o.departmentId),
    projectId: nullable(o.projectId, int),
    reportsToAgentId: nullable(o.reportsToAgentId, uuid),
    isActive: bool(o.isActive),
  };
}

function toOrg(v: unknown): OrgResponse {
  const o = obj(v);
  return {
    agents: arr(o.agents).map(agent),
    departments: arr(o.departments).map(lookup),
    roles: arr(o.roles).map(lookup),
    projects: arr(o.projects).map(lookup),
  };
}

function presenceEntry(v: unknown): PresenceEntry {
  const o = obj(v);
  return { agentId: uuid(o.agentId), online: bool(o.online), lastBeatAt: str(o.lastBeatAt) };
}

function toPresence(v: unknown): PresenceResponse {
  const o = obj(v);
  const hasData = bool(o.hasData);
  const agents = arr(o.agents).map(presenceEntry);
  // The contract says no data means an empty list. Anything else is refused
  // rather than shown, so "no data" can never render as "everyone offline".
  if (!hasData && agents.length > 0) throw new BadResponse();
  return { hasData, agents };
}

function activityRow(v: unknown): ActivityRow {
  const o = obj(v);
  const direction = str(o.direction);
  if (direction !== 'out' && direction !== 'in') throw new BadResponse();
  const day = str(o.day);
  if (!DAY.test(day)) throw new BadResponse();
  return { day, agentId: nullable(o.agentId, uuid), direction, count: int(o.count) };
}

function toActivity(v: unknown): ActivityResponse {
  const o = obj(v);
  return { from: str(o.from), to: str(o.to), rows: arr(o.rows).map(activityRow) };
}

const SHAPE: Record<WebRoute, (v: unknown) => unknown> = {
  org: toOrg,
  presence: toPresence,
  activity: toActivity,
};

// ── The handler ─────────────────────────────────────────────────────────────

export async function handleWebGet(route: WebRoute, req: NextRequest): Promise<NextResponse> {
  const auth = await authorise(req);
  if (auth instanceof NextResponse) return auth;

  let query = '';
  if (route === 'activity') {
    const q = activityQuery(req);
    if (q === null) return refuse(422, 'FLEET_REQUEST_INVALID');
    query = q;
  }

  const base = process.env.FLEET_API_BASE_URL;
  if (!base) {
    log(route, 500, 'FLEET_NOT_CONFIGURED');
    return refuse(500, 'FLEET_NOT_CONFIGURED');
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base.replace(/\/+$/, '')}${UPSTREAM_PATH[route]}${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    log(route, 502, 'FLEET_UNREACHABLE');
    return refuse(502, 'FLEET_UNREACHABLE');
  }

  if (!upstream.ok) {
    let code = '';
    try {
      const body = (await upstream.json()) as { code?: unknown };
      if (typeof body?.code === 'string' && FLEET_CODE.test(body.code)) code = body.code;
    } catch {
      /* no JSON body, e.g. a bare 405 */
    }
    if (code) {
      // The service's own code, with its own status (4xx or 5xx).
      const status = upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502;
      log(route, status, code);
      return refuse(status, code);
    }
    const fallback = `FLEET_UPSTREAM_${upstream.status}`;
    log(route, 502, fallback);
    return refuse(502, fallback);
  }

  try {
    const shaped = SHAPE[route](await upstream.json());
    return reply(200, shaped);
  } catch {
    log(route, 502, 'FLEET_BAD_RESPONSE');
    return refuse(502, 'FLEET_BAD_RESPONSE');
  }
}
