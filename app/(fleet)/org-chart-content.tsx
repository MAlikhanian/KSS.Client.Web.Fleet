'use client';

import { useMemo, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  buildOrgForest,
  listAgents,
  listDepartments,
  matchesFilter,
  type AgentFilter,
} from '@/lib/fleet/queries';
import type { Agent } from '@/lib/fleet/types';
import { AgentFilters } from './_components/agent-filters';
import { KpiTile } from './_components/cards';
import { AgentCard, OrgSubtree } from './_components/org-chart';
import { ScreenHeader } from './_components/screen-header';
import { useFleet } from './_components/use-fleet';

type View = 'hierarchy' | 'departments';

/**
 * Organization chart — read-only. No create, edit or delete control exists on
 * this screen by design; stage 1 is for approving the layout.
 *
 * Filters DIM non-matching agents in the hierarchy instead of removing them,
 * because removing a manager would orphan everyone below them and the chart
 * would stop being a hierarchy. The department view, which has no hierarchy
 * to protect, lists only the matching agents.
 */
export function OrgChartContent() {
  const { t, num, dept, name } = useFleet();
  const [filter, setFilter] = useState<AgentFilter>({ status: 'all' });
  const [view, setView] = useState<View>('hierarchy');

  const agents = listAgents();
  const forest = useMemo(() => buildOrgForest(agents), [agents]);
  const isMatch = (a: Agent) => matchesFilter(a, filter);
  const matching = agents.filter(isMatch);
  const byId = new Map(agents.map((a) => [a.agentId, a]));
  const filtered = Boolean(filter.departmentId || filter.projectId || (filter.status && filter.status !== 'all'));

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title={t('org.title')}
        description={t('org.description')}
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(v) => v && setView(v as View)}
          >
            <ToggleGroupItem value="hierarchy">{t('org.viewHierarchy')}</ToggleGroupItem>
            <ToggleGroupItem value="departments">{t('org.viewDepartments')}</ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label={t('org.kpiTotal')} value={num(agents.length)} />
        <KpiTile label={t('org.kpiActive')} value={num(agents.filter((a) => a.isActive).length)} />
        <KpiTile label={t('org.kpiInactive')} value={num(agents.filter((a) => !a.isActive).length)} />
        <KpiTile label={t('org.kpiTops')} value={num(forest.length)} />
      </div>

      <div className="flex flex-col gap-2">
        <AgentFilters value={filter} onChange={setFilter} />
        {filtered ? (
          <p className="text-sm text-muted-foreground">
            {matching.length === 0
              ? t('common.noAgents')
              : view === 'hierarchy'
                ? t('org.matching', { count: matching.length })
                : null}
          </p>
        ) : null}
      </div>

      {view === 'hierarchy' ? (
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
          {listDepartments().map((d) => {
            const members = matching.filter((a) => a.departmentId === d.id);
            if (members.length === 0) return null;
            return (
              <Card key={d.id}>
                <CardHeader>
                  <CardTitle>
                    {dept(d.id, d.name)} · {num(members.length)}
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
        </div>
      )}
    </div>
  );
}
