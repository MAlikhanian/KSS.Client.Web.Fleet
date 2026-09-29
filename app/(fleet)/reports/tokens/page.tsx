'use client';

import { useState } from 'react';
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
import {
  agentDays,
  byAgent,
  byDay,
  filterAgents,
  listDepartments,
  sumBy,
  totalTokens,
  type AgentFilter,
} from '@/lib/fleet/queries';
import { AgentFilters } from '../../_components/agent-filters';
import { AgentTable } from '../../_components/agent-table';
import { ChartCard, KpiTile, NoSourceCard } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

const PARTS = ['input', 'output', 'cacheWrite', 'cacheRead'] as const;
const TOP_N = 10;

export default function TokensReportPage() {
  const { t, num, compact, day, dept } = useFleet();
  const [filter, setFilter] = useState<AgentFilter>({});

  const rows = agentDays(filter);
  const agents = filterAgents(filter);

  const sumPart = (r: typeof rows, p: (typeof PARTS)[number]) => sumBy(r, (x) => x.tokens[p]);

  const perDay = byDay(rows, (r) => ({
    input: sumPart(r, 'input'),
    output: sumPart(r, 'output'),
    cacheWrite: sumPart(r, 'cacheWrite'),
    cacheRead: sumPart(r, 'cacheRead'),
  }));

  const perDept = listDepartments()
    .map((d) => {
      const ids = new Set(agents.filter((a) => a.departmentId === d.id).map((a) => a.agentId));
      return { department: dept(d.id, d.name), tokens: sumBy(rows.filter((r) => ids.has(r.agentId)), totalTokens) };
    })
    .filter((d) => d.tokens > 0);

  const top = byAgent(agents, rows, (r) => ({ total: sumBy(r, totalTokens), output: sumPart(r, 'output') }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);

  const partConfig: ChartConfig = {
    input: { label: t('tokens.input'), color: 'var(--chart-1)' },
    output: { label: t('tokens.output'), color: 'var(--chart-2)' },
    cacheWrite: { label: t('tokens.cacheWrite'), color: 'var(--chart-3)' },
    cacheRead: { label: t('tokens.cacheRead'), color: 'var(--chart-5)' },
  };
  const deptConfig: ChartConfig = { tokens: { label: t('tokens.colTotal'), color: 'var(--chart-1)' } };

  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('tokens.title')} description={t('tokens.description')} />
        <AgentFilters value={filter} onChange={setFilter} showStatus={false} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {PARTS.map((p) => (
            <KpiTile key={p} label={t(`tokens.${p}`)} value={compact(sumPart(rows, p))} />
          ))}
        </div>

        <ChartCard title={t('tokens.chartDaily')} note={t('tokens.chartDailyNote')}>
          <ChartContainer config={partConfig} className="h-72 w-full">
            <BarChart data={perDay}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickFormatter={day} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v: number) => compact(v)} tickLine={false} axisLine={false} width={80} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => day(String(v))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              {PARTS.map((p) => (
                <Bar key={p} dataKey={p} stackId="tok" fill={`var(--color-${p})`} />
              ))}
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ChartCard title={t('tokens.chartDepartment')} badge={t('common.currentRoster')}>
              {/* dir="ltr": see the same note in reports/hours. */}
              <ChartContainer config={deptConfig} className="h-64 w-full" dir="ltr">
                <BarChart data={perDept} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => compact(v)} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="department" tickLine={false} axisLine={false} width={96} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="tokens" fill="var(--color-tokens)" radius={4} />
                </BarChart>
              </ChartContainer>
            </ChartCard>
          </div>
          <NoSourceCard title={t('tokens.codexTitle')} hint={t('tokens.codexHint')} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('tokens.tableTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentTable
              rows={top}
              columns={[
                { key: 'total', header: t('tokens.colTotal'), value: (r) => num(r.total) },
                { key: 'out', header: t('tokens.output'), value: (r) => num(r.output) },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
