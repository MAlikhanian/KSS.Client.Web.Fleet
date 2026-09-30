'use client';

import { useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildOrgForest, isFiltered, matchesFilter, type AgentFilter } from '@/lib/fleet/org';
import { errorCode, useOrg, usePresence } from '@/lib/fleet/queries';
import type { Agent } from '@/lib/fleet/web-contract';
import { AgentFilters } from './_components/agent-filters';
import { ErrorState, KpiTile, LoadingState } from './_components/cards';
import { AgentCard, OrgContext, OrgSubtree } from './_components/org-chart';
import { ScreenHeader } from './_components/screen-header';
import { useFleet } from './_components/use-fleet';

type View = 'hierarchy' | 'departments';

/**
 * Organisation chart, from the Fleet service. Read-only: no create, edit or
 * delete control exists on this screen.
 *
 * Filters DIM non-matching agents in the hierarchy instead of removing them,
 * because removing a manager would orphan everyone below. The department view,
 * which has no hierarchy to protect, lists only the matching agents.
 *
 * Presence: when the service reports no data (`hasData: false`), the screen
 * says so and shows NO presence state on any card. It never renders the whole
 * team as offline.
 */
export function OrgChartContent() {
  const { t, num, name } = useFleet();
  const [filter, setFilter] = useState<AgentFilter>({ status: 'all' });
  const [view, setView] = useState<View>('hierarchy');

  const org = useOrg();
  const presence = usePresence();

  const agents = useMemo(() => org.data?.agents ?? [], [org.data]);
  const forest = useMemo(() => buildOrgForest(agents), [agents]);
  const online = useMemo(() => {
    if (!presence.data?.hasData) return null;
    return new Set(presence.data.agents.filter((a) => a.online).map((a) => a.agentId));
  }, [presence.data]);

  const header = (
    <ScreenHeader
      title={t('org.title')}
      description={t('org.description')}
      actions={
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)}>
          <ToggleGroupItem value="hierarchy">{t('org.viewHierarchy')}</ToggleGroupItem>
          <ToggleGroupItem value="departments">{t('org.viewDepartments')}</ToggleGroupItem>
        </ToggleGroup>
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
  const byId = new Map(agents.map((a) => [a.agentId, a]));

  return (
    <OrgContext.Provider value={{ org: data, online }}>
      <div className="flex flex-col gap-5">
        {header}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiTile label={t('org.kpiTotal')} value={num(agents.length)} />
          <KpiTile label={t('org.kpiActive')} value={num(agents.filter((a) => a.isActive).length)} />
          <KpiTile label={t('org.kpiInactive')} value={num(agents.filter((a) => !a.isActive).length)} />
          <KpiTile label={t('org.kpiTops')} value={num(forest.length)} />
          <KpiTile label={t('org.kpiOnline')} value={online ? num(online.size) : '—'} hint={online ? undefined : t('org.noPresence')} />
        </div>

        {presence.isError ? (
          <ErrorState code={errorCode(presence.error)} onRetry={() => presence.refetch()} />
        ) : presence.data && !presence.data.hasData ? (
          <p data-testid="fleet-no-presence" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="size-4" />
            {t('org.noPresence')}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <AgentFilters value={filter} onChange={setFilter} departments={data.departments} projects={data.projects} />
          {isFiltered(filter) ? (
            <p className="text-sm text-muted-foreground">
              {matching.length === 0
                ? t('common.noAgents')
                : view === 'hierarchy'
                  ? t('org.matching', { count: num(matching.length) })
                  : null}
            </p>
          ) : null}
        </div>

        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">{t('common.noAgents')}</CardContent>
          </Card>
        ) : view === 'hierarchy' ? (
          <Card>
            <CardContent className="overflow-x-auto py-6" data-testid="fleet-org-hierarchy">
              <div className="flex w-max min-w-full items-start justify-center gap-10">
                {forest.map((root) => (
                  <OrgSubtree key={root.agent.agentId} node={root} isMatch={isMatch} />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="fleet-org-departments">
            {data.departments.map((d) => {
              const members = matching.filter((a) => a.departmentId === d.id);
              if (members.length === 0) return null;
              return (
                <Card key={d.id}>
                  <CardHeader>
                    <CardTitle>
                      {d.name} ({num(members.length)})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5">
                    {members.map((a) => {
                      const manager = a.reportsToAgentId ? byId.get(a.reportsToAgentId) : undefined;
                      return (
                        <div key={a.agentId} className="flex flex-col gap-1">
                          <AgentCard agent={a} className="w-full" />
                          <span className="ps-2 text-xs text-muted-foreground">
                            {manager ? `${t('org.reportsTo')}: ${name(manager)}` : t('org.noManager')}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
            {/* Agents whose department is not in the lookup list still appear. */}
            {(() => {
              const known = new Set(data.departments.map((d) => d.id));
              const orphans = matching.filter((a) => !known.has(a.departmentId));
              if (orphans.length === 0) return null;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t('org.unknownDepartment')} ({num(orphans.length)})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2.5">
                    {orphans.map((a) => (
                      <AgentCard key={a.agentId} agent={a} className="w-full" />
                    ))}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}
      </div>
    </OrgContext.Provider>
  );
}
