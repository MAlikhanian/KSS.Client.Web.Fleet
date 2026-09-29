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
  sumBy,
  totalMessages,
  totalToolCalls,
  type AgentFilter,
} from '@/lib/fleet/queries';
import { AgentFilters } from '../../_components/agent-filters';
import { AgentTable } from '../../_components/agent-table';
import { ChartCard, KpiTile } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

const KINDS = ['inbound', 'outbound', 'internal', 'other'] as const;
const TOOLS = ['read', 'edit', 'search', 'shell', 'other'] as const;

export default function WorkReportPage() {
  const { t, num, day } = useFleet();
  const [filter, setFilter] = useState<AgentFilter>({});

  const rows = agentDays(filter);
  const agents = filterAgents(filter);

  const perDay = byDay(rows, (r) => ({
    inbound: sumBy(r, (x) => x.messages.inbound),
    outbound: sumBy(r, (x) => x.messages.outbound),
    internal: sumBy(r, (x) => x.messages.internal),
    other: sumBy(r, (x) => x.messages.other),
    online: sumBy(r, (x) => x.sessionsOnline),
    offline: sumBy(r, (x) => x.sessionsOffline),
  }));

  const perTool = TOOLS.map((tool) => ({
    tool: t(`work.tool.${tool}`),
    calls: sumBy(rows, (x) => x.toolCalls[tool]),
  }));

  const perAgent = byAgent(agents, rows, (r) => ({
    messages: sumBy(r, totalMessages),
    tools: sumBy(r, totalToolCalls),
    online: r.filter((x) => x.sessionsOnline > 0).length,
  })).sort((a, b) => b.messages - a.messages);

  const kindConfig: ChartConfig = {
    inbound: { label: t('work.kind.inbound'), color: 'var(--chart-1)' },
    outbound: { label: t('work.kind.outbound'), color: 'var(--chart-2)' },
    internal: { label: t('work.kind.internal'), color: 'var(--chart-5)' },
    other: { label: t('work.kind.other'), color: 'var(--chart-3)' },
  };
  const toolConfig: ChartConfig = { calls: { label: t('work.kpiToolCalls'), color: 'var(--chart-1)' } };
  const sessionConfig: ChartConfig = {
    online: { label: t('work.online'), color: 'var(--chart-2)' },
    offline: { label: t('work.offline'), color: 'var(--chart-4)' },
  };

  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('work.title')} description={t('work.description')} />
        <AgentFilters value={filter} onChange={setFilter} showStatus={false} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile label={t('work.kpiMessages')} value={num(sumBy(rows, totalMessages))} />
          <KpiTile label={t('work.kpiToolCalls')} value={num(sumBy(rows, totalToolCalls))} />
          <KpiTile label={t('work.kpiOnline')} value={num(sumBy(rows, (x) => x.sessionsOnline))} />
          <KpiTile label={t('work.kpiOffline')} value={num(sumBy(rows, (x) => x.sessionsOffline))} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title={t('work.chartMessages')} note={t('work.chartMessagesNote')}>
            <ChartContainer config={kindConfig} className="h-72 w-full">
              <BarChart data={perDay}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickFormatter={day} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => day(String(v))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                {KINDS.map((k) => (
                  <Bar key={k} dataKey={k} stackId="m" fill={`var(--color-${k})`} />
                ))}
              </BarChart>
            </ChartContainer>
          </ChartCard>

          <ChartCard title={t('work.chartTools')} note={t('work.chartToolsNote')}>
            {/* dir="ltr": see the same note in reports/hours. */}
            <ChartContainer config={toolConfig} className="h-72 w-full" dir="ltr">
              <BarChart data={perTool} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="tool" tickLine={false} axisLine={false} width={80} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="calls" fill="var(--color-calls)" radius={4} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
        </div>

        <ChartCard title={t('work.chartSessions')}>
          <ChartContainer config={sessionConfig} className="h-64 w-full">
            <BarChart data={perDay}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickFormatter={day} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => day(String(v))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="online" fill="var(--color-online)" radius={4} />
              <Bar dataKey="offline" fill="var(--color-offline)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>{t('work.tableTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentTable
              rows={perAgent}
              columns={[
                { key: 'm', header: t('work.colMessages'), value: (r) => num(r.messages) },
                { key: 't', header: t('work.colTools'), value: (r) => num(r.tools) },
                { key: 'o', header: t('work.colOnline'), value: (r) => num(r.online) },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
