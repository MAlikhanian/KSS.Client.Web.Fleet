'use client';

import { useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { isFiltered, matchesFilter, type AgentFilter } from '@/lib/fleet/org';
import { errorCode, useOrg, usePresence } from '@/lib/fleet/queries';
import type { Agent } from '@/lib/fleet/web-contract';
import { AgentFilters } from './_components/agent-filters';
import { ErrorState, LoadingState } from './_components/cards';
import { OrgBoxes, buildOrgBoxes } from './_components/org-boxes';
import { ScreenHeader } from './_components/screen-header';
import { useFleet } from './_components/use-fleet';

/**
 * Organisation, from the Fleet service. Read-only: no create, edit or delete
 * control exists on this screen.
 *
 * Layout: a compact leadership strip, then one dense box per team (Engineering
 * by project, every other department as one box), packed into columns sized to
 * their content so no area is left empty and the page never scrolls sideways.
 *
 * Filters DIM non-matching agents instead of removing them, so every box keeps
 * its shape and no manager disappears from her team.
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

  const layout = useMemo(() => (org.data ? buildOrgBoxes(org.data) : null), [org.data]);

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
        <OrgBoxes layout={layout!} org={data} online={online} isMatch={isMatch} />
      )}
    </div>
  );
}
