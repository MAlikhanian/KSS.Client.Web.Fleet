/**
 * Shapes for the Fleet stage-1 mock.
 *
 * `Agent` mirrors the columns of the planned Agent entity, so the stage-3
 * backend can replace the mock without reshaping the screens. The lookups
 * (department, role, project) are carried as ids, as the entity carries them.
 *
 * `nationalId` and `email` exist on the entity and are kept on this type so
 * the shape matches, but NO screen displays them: they are personal fields,
 * and showing them on an overview screen is not needed for any stage-1 view.
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
  /** Personal field. Kept for shape parity; never rendered. */
  nationalId: string;
  roleId: number;
  departmentId: number;
  projectId: number | null;
  /** Null for a top of the hierarchy. */
  reportsToAgentId: string | null;
  /** Personal field. Kept for shape parity; never rendered. */
  email: string;
  isActive: boolean;
}

/** One agent's activity for one day. Every figure is synthetic. */
export interface AgentDay {
  agentId: string;
  /** ISO date, yyyy-mm-dd. */
  day: string;
  messages: { inbound: number; outbound: number; internal: number; other: number };
  toolCalls: { read: number; edit: number; search: number; shell: number; other: number };
  sessionsOnline: number;
  sessionsOffline: number;
  tokens: { input: number; output: number; cacheWrite: number; cacheRead: number };
  /** An ESTIMATE: model-turn time, not presence. */
  activeMinutes: number;
}

export interface CapacityPoint {
  /** ISO timestamp. */
  at: string;
  fiveHourPct: number;
  sevenDayPct: number;
  /** How old the reading was when taken, in minutes. */
  payloadAgeMin: number;
}

export interface ReleaseCount {
  service: string;
  releases: number;
}
