'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { daysBetween, isFiltered, lookupName, matchesFilter, sumBy, utcDay, type AgentFilter } from '@/lib/fleet/org';
import { errorCode, useActivity, useOrg } from '@/lib/fleet/queries';
import { MAX_ACTIVITY_SPAN_DAYS, type ActivityRow } from '@/lib/fleet/web-contract';
import { AgentFilters } from '../../_components/agent-filters';
import { AgentTable } from '../../_components/agent-table';
import { ErrorState, LoadingState, NoSourceCard } from '../../_components/cards';
import { Avatar, MiniBars, deptStyle } from '../../_components/fleet-ui';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

function Period({
  from,
  to,
  setFrom,
  setTo,
  full,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  full?: boolean;
}) {
  const { t } = useFleet();
  return (
    <div className={full ? 'grid w-full grid-cols-2 gap-2' : 'flex flex-wrap items-end gap-2'}>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
        {t('work.from')}
        <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={full ? 'w-full' : 'w-40'} />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
        {t('work.to')}
        <Input type="date" value={to} min={from} max={utcDay(0)} onChange={(e) => setTo(e.target.value)} className={full ? 'w-full' : 'w-40'} />
      </label>
    </div>
  );
}

/**
 * Agent-to-agent Fleet messages, sent ("out") and received ("in"), per UTC day,
 * for the whole fleet and per department.
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
    // totals, the chart, the department cards and the table describe the same days.
    const periodFrom = activity.data?.from ?? from;
    const periodTo = activity.data?.to ?? to;
    const days = daysBetween(periodFrom, periodTo);
    const rows: ActivityRow[] = (activity.data?.rows ?? []).filter((r) => r.day >= periodFrom && r.day <= periodTo);
    const agents = org.data?.agents ?? [];
    const included = new Set(agents.filter((a) => matchesFilter(a, filter)).map((a) => a.agentId));
    const agentRows = rows.filter((r) => r.agentId !== null && included.has(r.agentId));
    const otherRows = filtered ? [] : rows.filter((r) => r.agentId === null);
    const counted = [...agentRows, ...otherRows];

    const perDay = days.map((d) => ({
      day: d,
      out: sumBy(counted.filter((r) => r.day === d && r.direction === 'out'), (r) => r.count),
      in: sumBy(counted.filter((r) => r.day === d && r.direction === 'in'), (r) => r.count),
    }));

    const perAgent = agents
      .filter((a) => included.has(a.agentId))
      .map((agent) => {
        const mine = agentRows.filter((r) => r.agentId === agent.agentId);
        return {
          agent,
          sent: sumBy(mine.filter((r) => r.direction === 'out'), (r) => r.count),
          received: sumBy(mine.filter((r) => r.direction === 'in'), (r) => r.count),
          daily: days.map((d) => sumBy(mine.filter((r) => r.day === d), (r) => r.count)),
        };
      })
      .sort((a, b) => b.sent + b.received - (a.sent + a.received));

    // Departments in the service's order, then any department id not in its list.
    const deptIds = [
      ...(org.data?.departments ?? []).map((d) => d.id),
      ...Array.from(new Set(perAgent.map((p) => p.agent.departmentId))).filter(
        (id) => !(org.data?.departments ?? []).some((d) => d.id === id),
      ),
    ];
    const perDept = deptIds
      .map((id) => {
        const members = perAgent.filter((p) => p.agent.departmentId === id && p.sent + p.received > 0);
        return {
          id,
          members,
          sent: sumBy(members, (m) => m.sent),
          received: sumBy(members, (m) => m.received),
          daily: days.map((_, i) => sumBy(members, (m) => m.daily[i])),
        };
      })
      .filter((d) => d.members.length)
      .sort((a, b) => b.sent + b.received - (a.sent + a.received));

    const other = {
      sent: sumBy(otherRows.filter((r) => r.direction === 'out'), (r) => r.count),
      received: sumBy(otherRows.filter((r) => r.direction === 'in'), (r) => r.count),
      present: otherRows.length > 0,
    };

    return {
      perDay,
      perAgent,
      perDept,
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
  const total = Math.max(1, model.totalSent + model.totalReceived);

  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader
          title={t('work.title')}
          description={t('work.description')}
          actions={
            // md and up only: the kit toolbar does not wrap, so on narrow screens
            // the period gets its own row below instead of widening the page.
            <div className="hidden md:block">
              <Period from={from} to={to} setFrom={setFrom} setTo={setTo} />
            </div>
          }
        />
        <div className="-mt-3 md:hidden">
          <Period from={from} to={to} setFrom={setFrom} setTo={setTo} full />
        </div>

        {org.data ? (
          <AgentFilters
            value={filter}
            onChange={setFilter}
            departments={org.data.departments}
            projects={org.data.projects}
            showStatus={false}
          />
        ) : null}
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
            <Card>
              <CardHeader className="min-h-0 flex-wrap gap-3 py-3.5">
                <CardTitle>{t('work.wholeFleet')}</CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowUpRight className="size-4 text-primary" />
                    {t('work.kpiSent')} <b className="tabular-nums">{num(model.totalSent)}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowDownLeft className="size-4 text-emerald-600" />
                    {t('work.kpiReceived')} <b className="tabular-nums">{num(model.totalReceived)}</b>
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 py-4">
                {/* contain:inline-size: the chart takes its width from the page and never widens it. */}
                <div className="w-full min-w-0 [contain:inline-size]">
                  <ChartContainer config={config} className="h-60 w-full">
                    <BarChart data={model.perDay} barGap={4}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickFormatter={day} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => day(String(v))} />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="out" fill="var(--color-out)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="in" fill="var(--color-in)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
                <p className="text-xs text-muted-foreground">{t('work.chartDailyNote')}</p>
              </CardContent>
            </Card>
            {model.hiddenOther ? (
              <p data-testid="fleet-other-hidden" className="text-sm text-muted-foreground">
                {t('work.otherFilteredNote')}
              </p>
            ) : null}

            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-foreground">{t('work.byDepartment')}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="fleet-work-departments">
                {model.perDept.map((d) => {
                  const s = deptStyle(org.data.departments, d.id);
                  const share = Math.round(((d.sent + d.received) / total) * 100);
                  return (
                    <Card key={d.id} className="overflow-hidden">
                      <div className={cn('h-1', s.bar)} />
                      <CardContent className="flex flex-col gap-4 p-5">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-base font-semibold text-foreground">
                              {lookupName(org.data.departments, d.id) || t('org.unknownDepartment')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t('work.deptSummary', { count: num(d.members.length), share: num(share) })}
                            </span>
                          </div>
                          <MiniBars values={d.daily} bar={s.bar} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-muted/50 p-3">
                            <div className="text-xs text-muted-foreground">{t('work.sent')}</div>
                            <div className="text-xl font-semibold tabular-nums">{num(d.sent)}</div>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3">
                            <div className="text-xs text-muted-foreground">{t('work.received')}</div>
                            <div className="text-xl font-semibold tabular-nums">{num(d.received)}</div>
                          </div>
                        </div>
                        <ul className="flex flex-col gap-2">
                          {d.members.slice(0, 3).map((r) => (
                            <li key={r.agent.agentId} className="flex min-w-0 items-center gap-2.5">
                              <Avatar agent={r.agent} size="sm" />
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {r.agent.firstName} {r.agent.lastName}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{num(r.sent + r.received)}</span>
                            </li>
                          ))}
                          {d.members.length > 3 ? (
                            <li className="text-xs text-muted-foreground">{t('work.andMore', { count: num(d.members.length - 3) })}</li>
                          ) : null}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
                {model.other.present ? (
                  <Card className="border-dashed shadow-none" data-testid="fleet-other-card">
                    <CardContent className="flex h-full flex-col justify-center gap-2 p-5 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        <Info className="size-4 shrink-0" />
                        {t('work.otherTitle')}
                      </span>
                      <span>{t('work.otherBody')}</span>
                      <span className="tabular-nums text-foreground">
                        {t('work.sent')} {num(model.other.sent)} · {t('work.received')} {num(model.other.received)}
                      </span>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
              {model.perDept.length === 0 && !model.other.present ? (
                <p className="text-sm text-muted-foreground">{t('common.noAgents')}</p>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('work.tableTitle')}</CardTitle>
              </CardHeader>
              {/* contain:inline-size: on a phone the table scrolls inside its own
                  container (AgentTable's overflow-x-auto) and never widens the page. */}
              <CardContent className="min-w-0 [contain:inline-size]">
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
          <h2 className="text-base font-semibold text-muted-foreground">{t('common.noSourceSection')}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <NoSourceCard title={t('work.telegramTitle')} />
            <NoSourceCard title={t('work.toolsTitle')} />
            <NoSourceCard title={t('work.sessionsTitle')} />
          </div>
        </div>
      </div>
    </Container>
  );
}
