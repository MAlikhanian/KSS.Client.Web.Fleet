'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { lookupName } from '@/lib/fleet/org';
import type { Agent, OrgResponse } from '@/lib/fleet/web-contract';
import { Avatar, deptStyle } from './fleet-ui';
import { useFleet } from './use-fleet';

/**
 * Everything the map needs besides the agents: the lookups, which agents are
 * online, and which match the filters. `online` is null when the service has no
 * presence data; then no dot and no count is drawn anywhere, so "no data" never
 * reads as "everyone offline".
 */
export interface MapContext {
  org: OrgResponse;
  online: Set<string> | null;
  isMatch: (a: Agent) => boolean;
  children: Map<string, Agent[]>;
  byId: Map<string, Agent>;
}

export function PersonCard({ agent, ctx, strong }: { agent: Agent; ctx: MapContext; strong?: boolean }) {
  const { t, name } = useFleet();
  const s = deptStyle(ctx.org.departments, agent.departmentId);
  const dept = lookupName(ctx.org.departments, agent.departmentId) || t('org.unknownDepartment');
  return (
    <div
      data-testid="fleet-agent-card"
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3 shadow-xs transition-opacity',
        strong && 'ring-2',
        strong && s.ring,
        !agent.isActive && 'border-dashed',
        !ctx.isMatch(agent) && 'opacity-30',
      )}
    >
      <Avatar agent={agent} size={strong ? 'lg' : 'md'} online={ctx.online?.has(agent.agentId)} />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-foreground">{name(agent)}</span>
        <span className="truncate text-xs text-muted-foreground">
          {lookupName(ctx.org.roles, agent.roleId)}
          {!agent.isActive ? ` · ${t('common.inactive')}` : ''}
        </span>
        <span className={cn('mt-1 inline-flex w-fit max-w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium', s.soft)}>
          <span className={cn('size-1.5 shrink-0 rounded-full', s.dot)} />
          <span className="truncate">{dept}</span>
        </span>
      </div>
    </div>
  );
}

/** Members of one team, nested by their manager inside the team. */
function teamTree(ids: Set<string>, ctx: MapContext, parent: Agent, depth: number): { a: Agent; depth: number }[] {
  const out: { a: Agent; depth: number }[] = [];
  for (const k of ctx.children.get(parent.agentId) ?? []) {
    if (!ids.has(k.agentId)) continue;
    out.push({ a: k, depth }, ...teamTree(ids, ctx, k, depth + 1));
  }
  return out;
}

/**
 * One department's column. Its heads are the members whose manager sits outside
 * the team; everyone else hangs under their own manager.
 */
export function Team({ deptId, members, ctx }: { deptId: number; members: Agent[]; ctx: MapContext }) {
  const { t, num, name } = useFleet();
  const s = deptStyle(ctx.org.departments, deptId);
  const ids = new Set(members.map((a) => a.agentId));
  const heads = members.filter((a) => !a.reportsToAgentId || !ids.has(a.reportsToAgentId));
  const onlineN = ctx.online ? members.filter((a) => ctx.online!.has(a.agentId)).length : null;
  return (
    <div className="flex min-w-0 flex-col items-stretch" data-testid="fleet-org-team">
      <span aria-hidden className="mx-auto h-5 w-px bg-border" />
      <Card className="h-full overflow-hidden">
        <div className={cn('h-1', s.bar)} />
        <CardContent className="flex flex-col gap-3 p-3">
          <div className="flex min-w-0 items-center justify-between gap-2 px-1">
            <span className={cn('inline-flex min-w-0 items-center gap-2 text-sm font-semibold', s.text)}>
              <span className={cn('size-2 shrink-0 rounded-full', s.dot)} />
              <span className="truncate">{lookupName(ctx.org.departments, deptId) || t('org.unknownDepartment')}</span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {num(members.length)}
              {onlineN !== null ? ` · ${t('org.onlineCount', { count: num(onlineN) })}` : ''}
            </span>
          </div>
          {heads.map((h) => {
            const boss = h.reportsToAgentId ? ctx.byId.get(h.reportsToAgentId) : undefined;
            const rest = teamTree(ids, ctx, h, 0);
            return (
              <div key={h.agentId} className="flex min-w-0 flex-col gap-2">
                <PersonCard agent={h} ctx={ctx} />
                {boss ? (
                  <span className="truncate px-1 text-[11px] text-muted-foreground">{t('org.reportsToName', { name: name(boss) })}</span>
                ) : null}
                {rest.length ? (
                  <ul className="flex flex-col gap-0.5 border-s-2 border-dashed ps-2">
                    {rest.map(({ a, depth }) => (
                      <li
                        key={a.agentId}
                        data-testid="fleet-agent-row"
                        className={cn('flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-opacity', !ctx.isMatch(a) && 'opacity-30')}
                        style={{ paddingInlineStart: `${depth * 14 + 6}px` }}
                      >
                        <Avatar agent={a} size="sm" online={ctx.online?.has(a.agentId)} />
                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-sm text-foreground">{name(a)}</span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {lookupName(ctx.org.roles, a.roleId)}
                            {!a.isActive ? ` · ${t('common.inactive')}` : ''}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
