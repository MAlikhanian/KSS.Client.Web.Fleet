'use client';

import { type ReactNode } from 'react';
import { CircleOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFleet } from './use-fleet';

export function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

export function ChartCard({
  title,
  note,
  badge,
  children,
}: {
  title: string;
  note?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-wrap gap-2">
        <CardTitle>{title}</CardTitle>
        {badge ? (
          <Badge variant="warning" appearance="light" size="sm">
            {badge}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

/**
 * A metric with no source. It shows NO number, on purpose: a zero or a dash
 * would read as a measurement, and nothing records this figure yet.
 */
export function NoSourceCard({ title, hint }: { title: string; hint?: string }) {
  const { t } = useFleet();
  return (
    <Card data-testid="fleet-no-source" className="border-dashed">
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-center gap-2">
          <CircleOff className="size-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        <Badge variant="secondary" appearance="light" size="sm" className="w-fit">
          {t('common.noSourceYet')}
        </Badge>
        <p className="text-xs text-muted-foreground">{hint ?? t('common.noSourceHint')}</p>
      </CardContent>
    </Card>
  );
}
