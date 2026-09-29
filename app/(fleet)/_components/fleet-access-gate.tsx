'use client';

import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Container } from '@/components/common/container';
import { Card, CardContent } from '@/components/ui/card';
import { usePermission } from '@/hooks/use-permission';
import { FLEET_READ_PERMISSION } from '@/lib/fleet/access';
import { useFleet } from './use-fleet';

/**
 * Renders the Fleet screens only for a caller whose session carries the Fleet
 * read permission; everyone else is told they have no access.
 *
 * PERMISSION ONLY, by design: `hasPermission`, never `hasRole` or `hasAny`.
 * Broad administrative roles are admitted by being granted the permission in
 * Auth, so the zone has a single rule to audit.
 *
 * This is a client-side gate over the session the Shell issued (the zone has
 * no backend of its own to ask). It decides what the zone RENDERS; it is not a
 * substitute for server-side enforcement once real data arrives.
 */
export function FleetAccessGate({ children }: { children: ReactNode }) {
  const { hasPermission } = usePermission();
  const { t } = useFleet();

  if (hasPermission([FLEET_READ_PERMISSION])) {
    return <>{children}</>;
  }

  return (
    <Container>
      <Card data-testid="fleet-access-denied">
        <CardContent className="flex items-start gap-3 py-6">
          <ShieldAlert className="size-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{t('access.deniedTitle')}</span>
            <span className="text-sm text-muted-foreground">{t('access.deniedBody')}</span>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
