import type { NextRequest } from 'next/server';
import { handleWebGet } from '@/lib/fleet/server/web-proxy';

// GET only. Next answers every other method with 405, so no write can reach
// the Fleet service through this route. All logic lives in web-proxy.ts.
export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return handleWebGet('activity', req);
}
