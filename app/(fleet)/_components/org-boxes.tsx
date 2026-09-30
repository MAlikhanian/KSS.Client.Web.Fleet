'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { lookupName } from '@/lib/fleet/org';
import type { Agent, OrgResponse } from '@/lib/fleet/web-contract';
import { Avatar, deptStyle, type DeptStyle } from './fleet-ui';
import { useFleet } from './use-fleet';

/**
 * The organisation as dense boxes: a compact leadership strip, then ONE BOX PER
 * TEAM packed into columns that fill the width.
 *
 * The rules, keyed on the NAMES the Fleet service serves (compared trimmed and
 * case-insensitively):
 *  - LEADERSHIP STRIP: everyone in a leadership department, AND everyone whose
 *    role is a C-level role, whatever their department (so a CTO filed under
 *    Engineering still sits in the strip).
 *  - Engineering is split by PROJECT. An engineer with no project goes in an
 *    "Engineering · no project" box, which exists only when someone is in it.
 *  - Every other department is ONE box, whatever projects its people carry.
 * A department that matches none of these still gets its own box, so a renamed
 * department is shown, never lost. If nothing matches the strip rule at all, the
 * strip falls back to the top of the reporting hierarchy.
 */
// The names as the Fleet service serves them (measured on the live data, 2026-09-30).
const LEADERSHIP_DEPARTMENTS = ['executive', 'advisory', 'board office', "founder's office", 'executive office'];
const LEADERSHIP_ROLES = ['ceo', 'coo', 'cto', 'ceo advisor'];
const BY_PROJECT_DEPARTMENTS = ['engineering'];

/** In the strip, someone whose ROLE is not itself a leadership role is labelled by her DEPARTMENT (e.g. an office's assistant). */
export const isLeadershipRole = (org: OrgResponse, a: Agent) => LEAD_ROLES.has(norm(lookupName(org.roles, a.roleId)));

const norm = (s: string) => s.trim().toLowerCase().replace(/’/g, "'");
const LEAD_DEPTS = new Set(LEADERSHIP_DEPARTMENTS);
const LEAD_ROLES = new Set(LEADERSHIP_ROLES);
const BY_PROJECT = new Set(BY_PROJECT_DEPARTMENTS);

export interface OrgBox {
  key: string;
  /** A project name (shown as served), or a department name (translated for display). */
  title: string;
  /** The served department name when the box is a department; null for a project box. */
  department: string | null;
  /** The Engineering box for engineers with no project. */
  noProject: boolean;
  style: DeptStyle;
  /** Members whose manager sits outside the box: shown first, as the lead(s). */
  leads: Agent[];
  /** Everyone else, nested under their manager inside the box. */
  rest: { agent: Agent; depth: number }[];
  size: number;
}

export interface OrgLayout {
  strip: Agent[];
  boxes: OrgBox[];
}

export function buildOrgBoxes(org: OrgResponse): OrgLayout {
  const agents = org.agents;
  const byId = new Map(agents.map((a) => [a.agentId, a]));
  const deptName = (a: Agent) => norm(lookupName(org.departments, a.departmentId));
  const roleName = (a: Agent) => norm(lookupName(org.roles, a.roleId));
  const children = new Map<string, Agent[]>();
  for (const a of agents) {
    if (a.reportsToAgentId && a.reportsToAgentId !== a.agentId && byId.has(a.reportsToAgentId)) {
      children.set(a.reportsToAgentId, [...(children.get(a.reportsToAgentId) ?? []), a]);
    }
  }

  let strip = agents.filter((a) => LEAD_DEPTS.has(deptName(a)) || LEAD_ROLES.has(roleName(a)));
  if (strip.length === 0) strip = agents.filter((a) => !a.reportsToAgentId || !byId.has(a.reportsToAgentId));
  const inStrip = new Set(strip.map((a) => a.agentId));
  // Order the strip down the hierarchy: tops first.
  const depthOf = (a: Agent) => {
    let d = 0;
    let cur = a.reportsToAgentId ? byId.get(a.reportsToAgentId) : undefined;
    while (cur && d < 20) {
      d++;
      cur = cur.reportsToAgentId ? byId.get(cur.reportsToAgentId) : undefined;
    }
    return d;
  };
  strip = [...strip].sort((x, y) => depthOf(x) - depthOf(y) || x.departmentId - y.departmentId || x.roleId - y.roleId);

  type Group = {
    title: string;
    department: string | null;
    noProject: boolean;
    style: DeptStyle;
    members: Agent[];
    order: number;
  };
  const groups = new Map<string, Group>();
  const put = (key: string, g: Omit<Group, 'members'>, a: Agent) => {
    const cur = groups.get(key) ?? { ...g, members: [] };
    cur.members.push(a);
    groups.set(key, cur);
  };
  for (const a of agents) {
    if (inStrip.has(a.agentId)) continue;
    const dName = lookupName(org.departments, a.departmentId);
    const dIndex = org.departments.findIndex((d) => d.id === a.departmentId);
    if (BY_PROJECT.has(norm(dName)) && a.projectId !== null) {
      const pi = org.projects.findIndex((p) => p.id === a.projectId);
      const pName = lookupName(org.projects, a.projectId) || `${dName} ${a.projectId}`;
      put(
        `p${a.projectId}`,
        {
          title: pName,
          department: null,
          noProject: false,
          style: deptStyle(org.projects, a.projectId),
          order: pi < 0 ? 999 : pi,
        },
        a,
      );
    } else if (BY_PROJECT.has(norm(dName))) {
      // Exists only when a real engineer is here: the strip has already taken the C-level roles.
      put(
        `d${a.departmentId}-none`,
        {
          title: dName,
          department: dName,
          noProject: true,
          style: deptStyle(org.departments, a.departmentId),
          order: 1000,
        },
        a,
      );
    } else {
      put(
        `d${a.departmentId}`,
        {
          title: dName,
          department: dName,
          noProject: false,
          style: deptStyle(org.departments, a.departmentId),
          order: 2000 + (dIndex < 0 ? 999 : dIndex),
        },
        a,
      );
    }
  }

  const boxes: OrgBox[] = [];
  for (const [key, g] of Array.from(groups.entries())) {
    const ids = new Set(g.members.map((a) => a.agentId));
    const leads = g.members.filter((a) => !a.reportsToAgentId || !ids.has(a.reportsToAgentId));
    const rest: { agent: Agent; depth: number }[] = [];
    const walk = (parent: Agent, depth: number) => {
      for (const k of children.get(parent.agentId) ?? []) {
        if (!ids.has(k.agentId)) continue;
        rest.push({ agent: k, depth });
        walk(k, depth + 1);
      }
    };
    leads.forEach((l) => walk(l, 0));
    boxes.push({
      key,
      title: g.title,
      department: g.department,
      noProject: g.noProject,
      style: g.style,
      leads,
      rest,
      size: g.members.length,
    });
  }
  boxes.sort((a, b) => groups.get(a.key)!.order - groups.get(b.key)!.order || a.title.localeCompare(b.title));
  return { strip, boxes };
}

/** Name and role on one line; a long role WRAPS below the name, it is never clipped. */
function NameRole({ agent, org, strong, byDepartment }: { agent: Agent; org: OrgResponse; strong?: boolean; byDepartment?: boolean }) {
  const { t, name, roleName, departmentName } = useFleet();
  const label = byDepartment ? departmentName(lookupName(org.departments, agent.departmentId)) : roleName(lookupName(org.roles, agent.roleId));
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[13px] leading-5">
      <bdi className={cn('min-w-0 break-words text-foreground', strong && 'font-semibold')}>{name(agent)}</bdi>
      <span className="min-w-0 break-words text-muted-foreground">
        {label}
        {!agent.isActive ? ` · ${t('common.inactive')}` : ''}
      </span>
    </span>
  );
}

export function PersonRow({
  agent,
  org,
  online,
  dimmed,
  lead,
  depth = 0,
}: {
  agent: Agent;
  org: OrgResponse;
  online: Set<string> | null;
  dimmed?: boolean;
  lead?: boolean;
  depth?: number;
}) {
  return (
    <li
      data-testid="fleet-agent-row"
      className={cn('flex min-w-0 items-start gap-2 rounded-md px-2 py-0.5 transition-opacity', lead && 'bg-muted/60', dimmed && 'opacity-30')}
      style={depth ? { paddingInlineStart: `${depth * 12 + 8}px` } : undefined}
    >
      <Avatar agent={agent} size="xs" online={online?.has(agent.agentId)} />
      <NameRole agent={agent} org={org} strong={lead} />
    </li>
  );
}

export function OrgBoxes({
  layout,
  org,
  online,
  isMatch,
}: {
  layout: OrgLayout;
  org: OrgResponse;
  online: Set<string> | null;
  isMatch: (a: Agent) => boolean;
}) {
  const { t, num, departmentName } = useFleet();
  return (
    <div className="flex flex-col gap-4" data-testid="fleet-org-map">
      {layout.strip.length ? (
        <Card className="px-3 py-2.5" data-testid="fleet-leadership">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
            <span className="me-2 shrink-0 text-xs font-semibold text-muted-foreground">
              {t('org.leadership')} · {num(layout.strip.length)}
            </span>
            {layout.strip.map((a) => (
              <span
                key={a.agentId}
                data-testid="fleet-agent-row"
                className={cn(
                  'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border bg-background py-0.5 pe-2.5 ps-0.5',
                  !isMatch(a) && 'opacity-30',
                )}
              >
                <Avatar agent={a} size="xs" online={online?.has(a.agentId)} />
                <NameRole agent={a} org={org} strong byDepartment={!isLeadershipRole(org, a)} />
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Columns sized to the content: boxes pack top to bottom, so no area is left empty. */}
      <div className="[column-gap:0.75rem] [column-width:14rem]" data-testid="fleet-org-boxes">
        {layout.boxes.map((box) => (
          <Card key={box.key} className="mb-3 break-inside-avoid overflow-hidden" data-testid="fleet-org-team">
            <div className={cn('h-0.5', box.style.bar)} />
            <div className="px-3 pb-1 pt-2">
              <h3 className={cn('min-w-0 break-words text-sm font-semibold', box.style.text)}>
                <bdi>{box.department !== null ? departmentName(box.title) : box.title}</bdi>
                {box.noProject ? (
                  <>
                    {' '}
                    · <bdi>{t('common.noProject')}</bdi>
                  </>
                ) : null}{' '}
                · <bdi>{num(box.size)}</bdi>
              </h3>
            </div>
            <ul className="flex flex-col px-1 pb-1.5">
              {box.leads.map((a) => (
                <PersonRow key={a.agentId} agent={a} org={org} online={online} dimmed={!isMatch(a)} lead={box.rest.length > 0} />
              ))}
              {box.rest.map(({ agent, depth }) => (
                <PersonRow key={agent.agentId} agent={agent} org={org} online={online} dimmed={!isMatch(agent)} depth={depth + 1} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
