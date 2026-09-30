'use client';

import { CircleDashed, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Agent, Lookup } from '@/lib/fleet/web-contract';
import { useFleet } from './use-fleet';

/**
 * One colour per department, by its position in the service's department list,
 * so the same department has the same colour on every screen.
 */
const DEPT = [
  { dot: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300', bar: 'bg-violet-500', ring: 'ring-violet-200 dark:ring-violet-900', text: 'text-violet-700 dark:text-violet-300' },
  { dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300', bar: 'bg-sky-500', ring: 'ring-sky-200 dark:ring-sky-900', text: 'text-sky-700 dark:text-sky-300' },
  { dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', bar: 'bg-emerald-500', ring: 'ring-emerald-200 dark:ring-emerald-900', text: 'text-emerald-700 dark:text-emerald-300' },
  { dot: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300', bar: 'bg-amber-500', ring: 'ring-amber-200 dark:ring-amber-900', text: 'text-amber-700 dark:text-amber-300' },
  { dot: 'bg-rose-500', soft: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300', bar: 'bg-rose-500', ring: 'ring-rose-200 dark:ring-rose-900', text: 'text-rose-700 dark:text-rose-300' },
  { dot: 'bg-teal-500', soft: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300', bar: 'bg-teal-500', ring: 'ring-teal-200 dark:ring-teal-900', text: 'text-teal-700 dark:text-teal-300' },
  { dot: 'bg-orange-500', soft: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300', bar: 'bg-orange-500', ring: 'ring-orange-200 dark:ring-orange-900', text: 'text-orange-700 dark:text-orange-300' },
];
const UNKNOWN = { dot: 'bg-muted-foreground', soft: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/60', ring: 'ring-border', text: 'text-muted-foreground' };

export type DeptStyle = (typeof DEPT)[number];

export function deptStyle(departments: Lookup[], id: number): DeptStyle {
  const i = departments.findIndex((d) => d.id === id);
  return i < 0 ? UNKNOWN : DEPT[i % DEPT.length];
}

/**
 * Initials in a circle. `online` is only ever true when the service reported
 * presence data; with no data the caller passes nothing and no dot is drawn.
 */
export function Avatar({ agent, size = 'md', online }: { agent: Agent; size?: 'xs' | 'sm' | 'md' | 'lg'; online?: boolean }) {
  const s = size === 'xs' ? 'size-6 text-[9px] ring-1' : size === 'sm' ? 'size-7 text-[10px]' : size === 'lg' ? 'size-12 text-sm' : 'size-9 text-xs';
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground ring-2 ring-background',
        s,
        !agent.isActive && 'opacity-50',
      )}
    >
      {agent.firstName[0] ?? ''}
      {agent.lastName[0] ?? ''}
      {online ? <span className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" /> : null}
    </span>
  );
}

/** A tiny per-day bar strip, oldest day first, left to right like the main chart. */
export function MiniBars({ values, bar, className }: { values: number[]; bar: string; className?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div dir="ltr" aria-hidden className={cn('flex h-8 w-24 shrink-0 items-end gap-0.5', className)}>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn('min-w-0 flex-1 rounded-sm', v ? bar : 'bg-muted')}
          style={{ height: `${v ? Math.max(12, Math.round((v / max) * 100)) : 12}%` }}
        />
      ))}
    </div>
  );
}

/**
 * A whole screen whose figures have no source yet. It shows NO number, on
 * purpose: a zero or a dash would read as a measurement. It says what is
 * missing, and what will appear once a source exists.
 */
export function NoSourceScreen({ coming }: { coming: string[] }) {
  const { t } = useFleet();
  return (
    <Card data-testid="fleet-no-source">
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <CircleDashed className="size-8 text-muted-foreground" />
        </span>
        <div className="flex max-w-lg flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">{t('common.noSourceScreenTitle')}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t('common.noSourceScreenBody')}</p>
        </div>
        <ul className="grid w-full max-w-md gap-2 text-start">
          {coming.map((c) => (
            <li key={c} className="flex items-start gap-2.5 rounded-lg border border-dashed bg-muted/30 px-3.5 py-2.5 text-sm text-foreground">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span className="min-w-0">{c}</span>
            </li>
          ))}
        </ul>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {t('common.noSourceNote')}
        </span>
      </CardContent>
    </Card>
  );
}
