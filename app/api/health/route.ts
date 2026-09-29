import { NextResponse } from 'next/server';

/**
 * Liveness / readiness probe for this zone app.
 *
 * Deliberately has NO dependencies — no database, no backend call, no session.
 * A probe that touches a backend kills the pod when the backend is down, and a
 * probe that needs a session fails every kubelet check (the kubelet carries no
 * cookie), so the pod would never become Ready.
 *
 * With basePath this is served at /fleet/api/health, a path the Shell does not
 * have, so a 200 there proves the request reached THIS app.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    app: 'fleet',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
