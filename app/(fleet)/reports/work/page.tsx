'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { daysBetween, isFiltered, lookupName, matchesFilter, sumBy, utcDay, type AgentFilter } from '@/lib/fleet/org';
import { errorCode, useActivity, useOrg } from '@/lib/fleet/queries';
import { MAX_ACTIVITY_SPAN_DAYS, type ActivityRow } from '@/lib/fleet/web-contract';
import { AgentFilters } from '../../_components/agent-filters';
import { AgentTable } from '../../_components/agent-table';
import { ChartCard, ErrorState, KpiTile, LoadingState, NoSourceCard } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

/**
 * Agent-to-agent Fleet messages, sent ("out") and received ("in"), per UTC day.
 *
 * The service folds every small bucket (below its minimum group size) into one
 * row per day and direction with no agent. That row is shown as served, as
 * "other". It is never split or recomputed here. While a department or project
 * filter is on it cannot be attributed, so it is left out and the screen says so.
 */
export default function WorkReportPage() {
  const { t, num, day } = useFleet();
  const [filter, setFilter] = useState<AgentFilter>({});
  const [from, setFrom] = useState(() => utcDay(6));
  const [to, setTo] = useState(() => utcDay(0));

  const spanDays = daysBetween(from, to).length - 1;
  const periodValid = spanDays >= 0 && spanDays <= MAX_ACTIVITY_SPAN_DAYS;

  const org = useOrg();
  const activity = useActivity(from, to, periodValid);

  const filtered = isFiltered(filter);

  const model = useMemo(() => {
    // Only rows inside the period the service says it answered are counted, so
    // totals, the per-day chart and the table always describe the same days.
    const periodFrom = activity.data?.from ?? from;
    const periodTo = activity.data?.to ?? to;
    const rows: ActivityRow[] = (activity.data?.rows ?? []).filter((r) => r.day >= periodFrom && r.day <= periodTo);
    const agents = org.data?.agents ?? [];
    const included = new Set(agents.filter((a) => matchesFilter(a, filter)).map((a) => a.agentId));
    const agentRows = rows.filter((r) => r.agentId !== null && included.has(r.agentId));
    const otherRows = filtered ? [] : rows.filter((r) => r.agentId === null);
    const counted = [...agentRows, ...otherRows];

    const perDay = daysBetween(periodFrom, periodTo).map((d) => ({
      day: d,
      out: sumBy(counted.filter((r) => r.day === d && r.direction === 'out'), (r) => r.count),
      in: sumBy(counted.filter((r) => r.day === d && r.direction === 'in'), (r) => r.count),
    }));

    const perAgent = agents
      .filter((a) => included.has(a.agentId))
      .map((agent) => ({
        agent,
        sent: sumBy(agentRows.filter((r) => r.agentId === agent.agentId && r.direction === 'out'), (r) => r.count),
        received: sumBy(agentRows.filter((r) => r.agentId === agent.agentId && r.direction === 'in'), (r) => r.count),
      }))
      .sort((a, b) => b.sent + b.received - (a.sent + a.received));

    const other = {
      sent: sumBy(otherRows.filter((r) => r.direction === 'out'), (r) => r.count),
      received: sumBy(otherRows.filter((r) => r.direction === 'in'), (r) => r.count),
      present: otherRows.length > 0,
    };

    return {
      perDay,
      perAgent,
      other,
      totalSent: sumBy(counted.filter((r) => r.direction === 'out'), (r) => r.count),
      totalReceived: sumBy(counted.filter((r) => r.direction === 'in'), (r) => r.count),
      hiddenOther: filtered && rows.some((r) => r.agentId === null),
    };
  }, [activity.data, org.data, filter, filtered, from, to]);

  const config: ChartConfig = {
    out: { label: t('work.sent'), color: 'var(--chart-1)' },
    in: { label: t('work.received'), color: 'var(--chart-2)' },
  };

  const failed = org.isError ? org.error : activity.isError ? activity.error : null;
  const loading = org.isPending || (periodValid && activity.isPending);

  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('work.title')} description={t('work.description')} />

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t('work.from')}</span>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t('work.to')}</span>
            <Input type="date" value={to} min={from} max={utcDay(0)} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </label>
          {org.data ? (
            <AgentFilters
              value={filter}
              onChange={setFilter}
              departments={org.data.departments}
              projects={org.data.projects}
              showStatus={false}
            />
          ) : null}
        </div>
        {!periodValid ? (
          <p className="text-sm text-destructive">{t('work.periodInvalid', { max: num(MAX_ACTIVITY_SPAN_DAYS + 1) })}</p>
        ) : null}

        {failed ? (
          <ErrorState
            code={errorCode(failed)}
            onRetry={() => {
              org.refetch();
              activity.refetch();
            }}
          />
        ) : loading ? (
          <LoadingState />
        ) : periodValid && org.data ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <KpiTile label={t('work.kpiSent')} value={num(model.totalSent)} />
              <KpiTile label={t('work.kpiReceived')} value={num(model.totalReceived)} />
            </div>

            <ChartCard title={t('work.chartDaily')} note={t('work.chartDailyNote')}>
              <ChartContainer config={config} className="h-72 w-full">
                <BarChart data={model.perDay}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickFormatter={day} tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => day(String(v))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="out" stackId="m" fill="var(--color-out)" />
                  <Bar dataKey="in" stackId="m" fill="var(--color-in)" />
                </BarChart>
              </ChartContainer>
            </ChartCard>
            {model.hiddenOther ? (
              <p data-testid="fleet-other-hidden" className="text-sm text-muted-foreground">
                {t('work.otherFilteredNote')}
              </p>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>{t('work.tableTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <AgentTable
                  rows={model.perAgent}
                  departmentName={(id) => lookupName(org.data?.departments, id)}
                  columns={[
                    { key: 's', header: t('work.colSent'), value: (r) => num(r.sent) },
                    { key: 'r', header: t('work.colReceived'), value: (r) => num(r.received) },
                  ]}
                  footer={
                    model.other.present
                      ? { label: t('work.otherRow'), values: [num(model.other.sent), num(model.other.received)] }
                      : null
                  }
                />
              </CardContent>
            </Card>
          </>
        ) : null}

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">{t('common.noSourceSection')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <NoSourceCard title={t('work.telegramTitle')} />
            <NoSourceCard title={t('work.toolsTitle')} />
            <NoSourceCard title={t('work.sessionsTitle')} />
          </div>
        </div>
      </div>
    </Container>
  );
}
