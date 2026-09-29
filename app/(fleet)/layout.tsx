'use client';

import type { ReactNode } from 'react';
import { FleetAccessGate } from './_components/fleet-access-gate';

/**
 * Every Fleet screen lives in this route group, so every one is behind the
 * access gate by construction. The health probe (app/api/health) is outside
 * the group and stays reachable without a session.
 */
export default function FleetLayout({ children }: { children: ReactNode }) {
  return <FleetAccessGate>{children}</FleetAccessGate>;
}
