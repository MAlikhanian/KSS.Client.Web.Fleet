'use client';

import { useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { buildOrgForest, isFiltered, matchesFilter, type AgentFilter } from '@/lib/fleet/org';
import { errorCode, useOrg, usePresence } from '@/lib/fleet/queries';
import type { Agent } from '@/lib/fleet/web-contract';
import { AgentFilters } from './_components/agent-filters';
import { ErrorState, LoadingState } from './_components/cards';
import { PersonCard, Team, type MapContext } from './_components/org-map';
import { ScreenHeader } from './_components/screen-header';
import { useFleet } from './_components/use-fleet';

/**
 * Organisation map, from the Fleet service. Read-only: no create, edit or
 * delete control exists on this screen.
 *
 * Layout: the top of the organisation, the people reporting straight to it,
 * then one column per department, each nested by manager. Columns wrap, so the
 * page never scrolls sideways at any width.
 *
 * Filters DIM non-matching agents instead of removing them, because removing a
 * manager would orphan everyone below.
 *
 * Presence: when the service reports no data (`hasData: false`), the screen
 * says so and shows NO presence state anywhere: no dot, no online count. It
 * never renders the whole team as offline.
 */
export function OrgChartContent() {
  const { t, num } = useFleet();
  const [filter, setFilter] = useState<AgentFilter>({ status: 'all' });

  const org = useOrg();
  const presence = usePresence();

  const agents = useMemo(() => org.data?.agents ?? [], [org.data]);
  const online = useMemo(() => {
    if (!presence.data?.hasData) return null;
    return new Set(presence.data.agents.filter((a) => a.online).map((a) => a.agentId));
  }, [presence.data]);

  const layout = useMemo(() => {
    const forest = buildOrgForest(agents);
    const byId = new Map(agents.map((a) => [a.agentId, a]));
    const children = new Map<string, Agent[]>();
    const walk = (nodes: typeof forest) => {
      for (const n of nodes) {
        children.set(n.agent.agentId, n.children.map((c) => c.agent));
        walk(n.children);
      }
    };
    walk(forest);
    const roots = forest.map((n) => n.agent);
    const spine = forest.flatMap((n) => n.children.map((c) => c.agent));
    const placed = new Set([...roots, ...spine].map((a) => a.agentId));
    const rest = agents.filter((a) => !placed.has(a.agentId));
    return { byId, children, roots, spine, rest };
  }, [agents]);

  const header = (
    <ScreenHeader
      title={t('org.title')}
      description={t('org.description')}
      actions={
        org.data ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" appearance="light">{t('org.agentsCount', { count: num(agents.length) })}</Badge>
            {online ? <Badge variant="success" appearance="light">{t('org.onlineCount', { count: num(online.size) })}</Badge> : null}
          </div>
        ) : undefined
      }
    />
  );

  if (org.isPending) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <LoadingState />
      </div>
    );
  }
  if (org.isError || !org.data) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <ErrorState code={errorCode(org.error)} onRetry={() => org.refetch()} />
      </div>
    );
  }

  const data = org.data;
  const isMatch = (a: Agent) => matchesFilter(a, filter);
  const matching = agents.filter(isMatch);
  const ctx: MapContext = { org: data, online, isMatch, children: layout.children, byId: layout.byId };

  // One team per department in the service's order; agents whose department is
  // not in the lookup list still appear, in a team of their own.
  const known = new Set(data.departments.map((d) => d.id));
  const teams = [
    ...data.departments.map((d) => ({ id: d.id, members: layout.rest.filter((a) => a.departmentId === d.id) })),
    ...Array.from(new Set(layout.rest.filter((a) => !known.has(a.departmentId)).map((a) => a.departmentId))).map((id) => ({
      id,
      members: layout.rest.filter((a) => a.departmentId === id),
    })),
  ].filter((team) => team.members.length);

  return (
    <div className="flex flex-col gap-5">
      {header}

      {presence.isError ? (
        <ErrorState code={errorCode(presence.error)} onRetry={() => presence.refetch()} />
      ) : presence.data && !presence.data.hasData ? (
        <p data-testid="fleet-no-presence" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Radio className="size-4 shrink-0" />
          {t('org.noPresence')}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <AgentFilters value={filter} onChange={setFilter} departments={data.departments} projects={data.projects} />
        {isFiltered(filter) ? (
          <p className="text-sm text-muted-foreground">
            {matching.length === 0 ? t('common.noAgents') : t('org.matching', { count: num(matching.length) })}
          </p>
        ) : null}
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">{t('common.noAgents')}</CardContent>
        </Card>
      ) : (
        <section className="flex flex-col items-stretch" data-testid="fleet-org-map">
          <div className="flex flex-col items-center">
            <div className="grid w-full max-w-3xl grid-cols-1 justify-items-center gap-3 sm:grid-cols-[repeat(auto-fit,minmax(16rem,20rem))] sm:justify-center">
              {layout.roots.map((r) => (
                <div key={r.agentId} className="w-full max-w-xs">
                  <PersonCard agent={r} ctx={ctx} strong />
                </div>
              ))}
            </div>
            {layout.spine.length ? (
              <>
                <span aria-hidden className="h-5 w-px bg-border" />
                <div className="w-full max-w-5xl border-t pt-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {layout.spine.map((a) => (
                      <PersonCard key={a.agentId} agent={a} ctx={ctx} />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            {teams.length ? <span aria-hidden className="h-6 w-px bg-border" /> : null}
          </div>
          {teams.length ? (
            // The line across the teams; teams wrap, so nothing is ever wider than the page.
            <div className="border-t">
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {teams.map((team) => (
                  <Team key={team.id} deptId={team.id} members={team.members} ctx={ctx} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
