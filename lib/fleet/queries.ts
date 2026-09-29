import {
  AGENT_DAYS,
  AGENTS,
  CAPACITY,
  DEPARTMENTS,
  MOCK_DAYS,
  PROJECTS,
  RELEASES,
  ROLES,
} from './mock-data';
import type { Agent, AgentDay } from './types';

/**
 * The only way the screens read Fleet data. Stage 3 swaps these bodies for
 * service calls and the screens do not change.
 */

export interface AgentFilter {
  departmentId?: number | null;
  projectId?: number | null;
  /** 'active' | 'inactive' | 'all' */
  status?: 'active' | 'inactive' | 'all';
}

export const listDepartments = () => DEPARTMENTS;
export const listRoles = () => ROLES;
export const listProjects = () => PROJECTS;
export const listDays = () => MOCK_DAYS;
export const listCapacity = () => CAPACITY;
export const listReleases = () => RELEASES;

export const listAgents = (): Agent[] => AGENTS;

export const departmentName = (id: number | null | undefined) =>
  DEPARTMENTS.find((d) => d.id === id)?.name ?? '';
export const roleName = (id: number | null | undefined) =>
  ROLES.find((r) => r.id === id)?.name ?? '';
export const projectName = (id: number | null | undefined) =>
  PROJECTS.find((p) => p.id === id)?.name ?? '';

export const fullName = (a: Pick<Agent, 'firstName' | 'lastName'>) =>
  `${a.firstName} ${a.lastName}`;

export function matchesFilter(agent: Agent, f: AgentFilter): boolean {
  if (f.departmentId && agent.departmentId !== f.departmentId) return false;
  if (f.projectId && agent.projectId !== f.projectId) return false;
  if (f.status === 'active' && !agent.isActive) return false;
  if (f.status === 'inactive' && agent.isActive) return false;
  return true;
}

export function filterAgents(f: AgentFilter): Agent[] {
  return AGENTS.filter((a) => matchesFilter(a, f));
}

export interface OrgNode {
  agent: Agent;
  children: OrgNode[];
}

/**
 * The ReportsTo hierarchy as a forest. An agent whose manager is missing from
 * the list is treated as a top, so a broken link never hides an agent.
 */
export function buildOrgForest(agents: Agent[] = AGENTS): OrgNode[] {
  const byId = new Map(agents.map((a) => [a.agentId, { agent: a, children: [] as OrgNode[] }]));
  const roots: OrgNode[] = [];
  for (const node of Array.from(byId.values())) {
    const parentId = node.agent.reportsToAgentId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: OrgNode[]) => {
    nodes.sort((a, b) => a.agent.roleId - b.agent.roleId || fullName(a.agent).localeCompare(fullName(b.agent)));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function agentDays(f: AgentFilter = {}): AgentDay[] {
  const ids = new Set(filterAgents(f).map((a) => a.agentId));
  return AGENT_DAYS.filter((d) => ids.has(d.agentId));
}

export function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

/** Rows grouped by day, in calendar order, with every day present. */
export function byDay<R>(rows: AgentDay[], reduce: (rows: AgentDay[]) => R): Array<{ day: string } & R> {
  return MOCK_DAYS.map((day) => ({ day, ...reduce(rows.filter((r) => r.day === day)) }));
}

/** Rows grouped by agent, for the agents passed in. */
export function byAgent<R>(agents: Agent[], rows: AgentDay[], reduce: (rows: AgentDay[]) => R): Array<{ agent: Agent } & R> {
  return agents.map((agent) => ({ agent, ...reduce(rows.filter((r) => r.agentId === agent.agentId)) }));
}

export const totalTokens = (d: AgentDay) =>
  d.tokens.input + d.tokens.output + d.tokens.cacheWrite + d.tokens.cacheRead;
export const totalMessages = (d: AgentDay) =>
  d.messages.inbound + d.messages.outbound + d.messages.internal + d.messages.other;
export const totalToolCalls = (d: AgentDay) =>
  d.toolCalls.read + d.toolCalls.edit + d.toolCalls.search + d.toolCalls.shell + d.toolCalls.other;
