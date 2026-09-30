import type { Agent, Lookup } from './web-contract';

/** Pure helpers over the org data. No I/O; safe on server and client. */

export interface AgentFilter {
  departmentId?: number | null;
  projectId?: number | null;
  status?: 'active' | 'inactive' | 'all';
}

export function isFiltered(f: AgentFilter): boolean {
  return Boolean(f.departmentId || f.projectId || (f.status && f.status !== 'all'));
}

export function matchesFilter(agent: Agent, f: AgentFilter): boolean {
  if (f.departmentId && agent.departmentId !== f.departmentId) return false;
  if (f.projectId && agent.projectId !== f.projectId) return false;
  if (f.status === 'active' && !agent.isActive) return false;
  if (f.status === 'inactive' && agent.isActive) return false;
  return true;
}

export const fullName = (a: Pick<Agent, 'firstName' | 'lastName'>) => `${a.firstName} ${a.lastName}`;

export interface OrgNode {
  agent: Agent;
  children: OrgNode[];
}

/**
 * The ReportsTo hierarchy as a forest. An agent whose manager is not in the
 * list is treated as a top, so a broken link never hides an agent.
 */
export function buildOrgForest(agents: Agent[]): OrgNode[] {
  const byId = new Map(agents.map((a) => [a.agentId, { agent: a, children: [] as OrgNode[] }]));
  const roots: OrgNode[] = [];
  for (const node of Array.from(byId.values())) {
    const parentId = node.agent.reportsToAgentId;
    const parent = parentId && parentId !== node.agent.agentId ? byId.get(parentId) : undefined;
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

/** Name of a lookup row by id, or '' when unknown. */
export function lookupName(list: Lookup[] | undefined, id: number | null | undefined): string {
  if (id === null || id === undefined || !list) return '';
  return list.find((l) => l.id === id)?.name ?? '';
}

export function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

/** Every UTC day from `from` to `to` inclusive, as YYYY-MM-DD. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return out;
  for (let t = start; t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Today in UTC, and the day `n` days before it, as YYYY-MM-DD. */
export function utcDay(offsetDays = 0, now = Date.now()): string {
  return new Date(now - offsetDays * 86_400_000).toISOString().slice(0, 10);
}
