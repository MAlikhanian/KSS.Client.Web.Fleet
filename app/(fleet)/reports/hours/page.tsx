'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  agentDays,
  byAgent,
  byDay,
  filterAgents,
  listDepartments,
  sumBy,
  type AgentFilter,
} from '@/lib/fleet/queries';
import { AgentFilters } from '../../_components/agent-filters';
import { AgentTable } from '../../_components/agent-table';
import { ChartCard, KpiTile } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

const toHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/**
 * Every figure on this screen is an ESTIMATE of model-turn time, not of
 * presence, and the screen says so in its banner, every chart title and the
 * table title — a number that is only labelled once gets quoted without it.
 */
export default function HoursReportPage() {
  const { t, num, day, dept } = useFleet();
  const [filter, setFilter] = useState<AgentFilter>({});

  const rows = agentDays(filter);
  const agents = filterAgents(filter);
  const activeDays = rows.filter((r) => r.activeMinutes > 0);
  const totalMin = sumBy(rows, (r) => r.activeMinutes);

  const perDay = byDay(rows, (r) => ({ hours: toHours(sumBy(r, (x) => x.activeMinutes)) }));

  const perDept = listDepartments()
    .map((d) => {
      const ids = new Set(agents.filter((a) => a.departmentId === d.id).map((a) => a.agentId));
      return {
        department: dept(d.id, d.name),
        hours: toHours(sumBy(rows.filter((r) => ids.has(r.agentId)), (x) => x.activeMinutes)),
      };
    })
    .filter((d) => d.hours > 0);

  const perAgent = byAgent(agents, rows, (r) => {
    const worked = r.filter((x) => x.activeMinutes > 0);
    const min = sumBy(r, (x) => x.activeMinutes);
    return { hours: toHours(min), avg: worked.length ? Math.round(min / worked.length) : 0 };
  }).sort((a, b) => b.hours - a.hours);

  const config: ChartConfig = { hours: { label: t('hours.colHours'), color: 'var(--chart-2)' } };

  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('hours.title')} description={t('hours.description')} />

        <div
          role="note"
          data-testid="fleet-estimate-banner"
          className="flex items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <TriangleAlert className="size-4 shrink-0" />
          <span>{t('hours.estimateBanner')}</span>
        </div>

        <AgentFilters value={filter} onChange={setFilter} showStatus={false} />

        <div className="grid grid-cols-2 gap-4">
          <KpiTile
            label={t('hours.kpiTotal')}
            value={`${num(toHours(totalMin))} ${t('hours.hoursUnit')}`}
            hint={t('common.estimate')}
          />
          <KpiTile
            label={t('hours.kpiAvg')}
            value={`${num(activeDays.length ? Math.round(totalMin / activeDays.length) : 0)} ${t('hours.minutesUnit')}`}
            hint={t('common.estimate')}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title={t('hours.chartDaily')} badge={t('common.estimate')}>
            <ChartContainer config={config} className="h-64 w-full">
              <BarChart data={perDay}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickFormatter={day} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => day(String(v))} />} />
                <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
              </BarChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard title={t('hours.chartDepartment')} badge={t('common.estimate')}>
            {/* dir="ltr": under an RTL page the SVG anchors category labels to the
                wrong edge and clips them. The labels themselves still render RTL text. */}
            <ChartContainer config={config} className="h-64 w-full" dir="ltr">
              <BarChart data={perDept} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="department" tickLine={false} axisLine={false} width={96} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('hours.tableTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentTable
              rows={perAgent}
              columns={[
                { key: 'h', header: t('hours.colHours'), value: (r) => num(r.hours) },
                { key: 'a', header: t('hours.colAvg'), value: (r) => num(r.avg) },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
