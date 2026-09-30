'use client';

import { type ReactNode } from 'react';
import { CircleDashed, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export function LoadingState() {
  const { t } = useFleet();
  return (
    <Card data-testid="fleet-loading">
      <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        {t('common.loading')}
      </CardContent>
    </Card>
  );
}

/**
 * A failed load. Shows the Fleet service's own error code (FLEET_...) so a
 * failure names its cause, e.g. a token the service cannot verify. Never shows
 * a token or any other secret: the code is all the zone's route passes on.
 */
export function ErrorState({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const { t } = useFleet();
  return (
    <Card data-testid="fleet-error" className="border-destructive/40">
      <CardContent className="flex flex-col gap-2 py-5">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <TriangleAlert className="size-4 text-destructive" />
          {t('common.errorTitle')}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('common.errorCode')} <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{code}</code>
        </p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * A metric with no source. It shows NO number, on purpose: a zero or a dash
 * would read as a measurement, and nothing records this figure yet.
 */
export function NoSourceCard({ title }: { title: string }) {
  const { t } = useFleet();
  return (
    <Card data-testid="fleet-no-source" className="border-dashed shadow-none">
      <CardContent className="flex items-center gap-3 py-3.5">
        <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-foreground">{title}</span>
          <span className="truncate text-xs text-muted-foreground">{t('common.noSourceYet')}</span>
        </div>
      </CardContent>
    </Card>
  );
}
