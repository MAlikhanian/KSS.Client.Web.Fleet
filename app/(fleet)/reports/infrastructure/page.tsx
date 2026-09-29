'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Container } from '@/components/common/container';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { listCapacity, listReleases } from '@/lib/fleet/queries';
import { ChartCard, NoSourceCard } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

/**
 * Capacity and releases have a source and are charted. Connection failures,
 * rollbacks, tasks and promises do not, and are shown as "no source yet"
 * cards with NO number — a zero would read as a measurement.
 */
export default function InfrastructureReportPage() {
  const { t, num, dateTime } = useFleet();

  const capacity = listCapacity();
  const latest = capacity[capacity.length - 1];

  const capacityConfig: ChartConfig = {
    fiveHourPct: { label: t('infra.fiveHour'), color: 'var(--chart-1)' },
    sevenDayPct: { label: t('infra.sevenDay'), color: 'var(--chart-4)' },
    payloadAgeMin: { label: t('infra.payloadAge'), color: 'var(--chart-3)' },
  };
  const releaseConfig: ChartConfig = { releases: { label: t('infra.chartReleases'), color: 'var(--chart-2)' } };

  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('infra.title')} description={t('infra.description')} />

        <ChartCard
          title={t('infra.chartCapacity')}
          note={`${t('infra.capacityNote')} ${latest ? t('infra.latestAge', { min: num(latest.payloadAgeMin) }) : ''}`}
        >
          <ChartContainer config={capacityConfig} className="h-72 w-full">
            <LineChart data={capacity}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="at" tickFormatter={(v: string) => dateTime(v)} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${num(v)}%`} tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => dateTime(String(v))} />} />
              {/* The reading-age series is tooltip-only, so it is kept out of the legend. */}
              <ChartLegend
                content={(props) => (
                  <ChartLegendContent
                    payload={props.payload?.filter((p) => p.dataKey !== 'payloadAgeMin')}
                    verticalAlign={props.verticalAlign}
                  />
                )}
              />
              <Line dataKey="fiveHourPct" stroke="var(--color-fiveHourPct)" strokeWidth={2} dot={false} />
              <Line dataKey="sevenDayPct" stroke="var(--color-sevenDayPct)" strokeWidth={2} dot={false} />
              {/* Carried so the tooltip shows each reading's age; not drawn. */}
              <Line dataKey="payloadAgeMin" stroke="transparent" dot={false} activeDot={false} legendType="none" />
            </LineChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title={t('infra.chartReleases')} note={t('infra.releasesNote')}>
          <ChartContainer config={releaseConfig} className="h-64 w-full">
            <BarChart data={listReleases()}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="service" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="releases" fill="var(--color-releases)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">{t('infra.placeholders')}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NoSourceCard title={t('infra.mcpTitle')} />
            <NoSourceCard title={t('infra.rollbacksTitle')} />
            <NoSourceCard title={t('infra.tasksTitle')} />
            <NoSourceCard title={t('infra.promisesTitle')} />
          </div>
        </div>
      </div>
    </Container>
  );
}
