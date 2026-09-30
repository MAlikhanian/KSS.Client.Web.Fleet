/**
 * The Fleet service's web read contract (v1): `GET /api/web/*`.
 *
 * TYPES ONLY. The zone's server routes validate every upstream response
 * against these shapes and copy only these fields (lib/fleet/server/web-proxy.ts);
 * the screens receive nothing else. Adding a field here is a contract change
 * and needs the service side to agree first.
 *
 * Deliberately absent: national id, email, folder, session references and any
 * message or entry text. They are never sent to the browser, not merely hidden.
 */

export interface Lookup {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Agent {
  /** UUID version 7. */
  agentId: string;
  firstName: string;
  lastName: string;
  roleId: number;
  departmentId: number;
  projectId: number | null;
  /** Null for a top of the hierarchy. */
  reportsToAgentId: string | null;
  isActive: boolean;
}

export interface OrgResponse {
  agents: Agent[];
  departments: Lookup[];
  roles: Lookup[];
  projects: Lookup[];
}

export interface PresenceEntry {
  agentId: string;
  /** True when the last heartbeat is recent (the service decides the window). */
  online: boolean;
  /** ISO timestamp, UTC. */
  lastBeatAt: string;
}

/**
 * v1.1. `hasData: false` means no agent has sent a heartbeat inside the
 * service's window; `agents` is then empty and the screens show "no presence
 * data yet", NEVER the whole fleet as offline. With data, only agents that
 * have ever reported appear; an absent agent has never been seen.
 */
export interface PresenceResponse {
  hasData: boolean;
  agents: PresenceEntry[];
}

export type ActivityDirection = 'out' | 'in';

/**
 * One aggregate: agent-to-agent Fleet messages sent ("out") or received ("in")
 * by one agent on one UTC day.
 *
 * `agentId: null` is the "other" bucket: the service folds every bucket below
 * its minimum group size into one row per day and direction. The screens show
 * it as served and never try to split or recompute it.
 */
export interface ActivityRow {
  day: string;
  agentId: string | null;
  direction: ActivityDirection;
  count: number;
}

export interface ActivityResponse {
  from: string;
  to: string;
  rows: ActivityRow[];
}

/** Error body from the zone's routes and from the service: `{ code: "FLEET_..." }`. */
export interface FleetErrorBody {
  code: string;
}

/** Inclusive activity range limit: `to - from` may be at most this many days. */
export const MAX_ACTIVITY_SPAN_DAYS = 92;
