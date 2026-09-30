import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { FLEET_READ_PERMISSION } from '@/lib/fleet/access';
import { normalizeHost, resolveTenant } from '@/lib/tenants';

/**
 * Server-side guard for the whole Fleet zone. Fails closed.
 *
 * Every request needs a VERIFIED NextAuth session (the Shell's cookie, checked
 * with NEXTAUTH_SECRET), a live Auth access token inside it, and the Fleet read
 * permission. Otherwise:
 *   - no or invalid session, no access token, or an expired one:
 *       pages -> 307 to the Shell's /signin · API -> 401
 *   - signed in without the permission:
 *       pages -> the /forbidden page · API -> 403 FLEET_NO_READ
 *
 * PERMISSION ONLY: there is no role bypass. A role that should see Fleet is
 * given the permission in Auth. This is the same single rule the data routes
 * re-check (lib/fleet/server/web-proxy.ts), so a mistake in the matcher below
 * cannot open data on its own.
 */

function stripBase(pathname: string): string {
  // With a basePath, Next may present the path with or without the prefix.
  if (pathname === '/fleet') return '/';
  return pathname.startsWith('/fleet/') ? pathname.slice('/fleet'.length) : pathname;
}

function isApi(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

const LOOPBACK = /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/;

/**
 * The origin to send a signed-out visitor to. `x-kss-host` is set by the Shell
 * when it rewrites a request to this zone. It is used ONLY when it names a
 * configured tenant host (or loopback in development), never verbatim, so a
 * client-supplied value cannot turn this into an open redirect.
 */
function visitorOrigin(req: NextRequest): string {
  const header = req.headers.get('x-kss-host') ?? '';
  if (LOOPBACK.test(header)) return `http://${header}`;
  if (resolveTenant(header)) return `https://${normalizeHost(header)}`;
  return req.nextUrl.origin;
}

function toSignIn(req: NextRequest, pathname: string): NextResponse {
  if (isApi(pathname)) {
    return NextResponse.json({ code: 'FLEET_SESSION_MISSING', message: 'Unauthorized' }, { status: 401 });
  }
  // The sign-in page lives in the Shell, so the redirect is absolute and the
  // way back carries this zone's basePath.
  const back = `${req.nextUrl.basePath}${pathname === '/' ? '' : pathname}${req.nextUrl.search}` || '/';
  const target = new URL('/signin', visitorOrigin(req));
  target.searchParams.set('callbackUrl', back);
  return new NextResponse(null, { status: 307, headers: { Location: target.toString() } });
}

function expired(tokenExpires: unknown, now: number): boolean {
  if (typeof tokenExpires !== 'string') return false;
  const at = Date.parse(tokenExpires);
  return Number.isFinite(at) && at <= now;
}

/**
 * A signed-in application is never indexed. Every response this middleware
 * produces, allowed or refused, carries the rule, so it holds even for a page
 * whose HTML a crawler never parses (a redirect, a 401, a 403).
 */
function noIndex(res: NextResponse): NextResponse {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export async function middleware(req: NextRequest) {
  return noIndex(await guard(req));
}

async function guard(req: NextRequest): Promise<NextResponse> {
  const pathname = stripBase(req.nextUrl.pathname);

  let token: Awaited<ReturnType<typeof getToken>> = null;
  try {
    // Verifies the signature. A missing secret, or a cookie signed with any
    // other secret, decodes to null and is refused.
    token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  } catch {
    token = null;
  }
  if (!token || !token.accessToken || expired(token.tokenExpires, Date.now())) {
    return toSignIn(req, pathname);
  }

  // The refusal page is readable by any signed-in person; it is what they see.
  if (pathname === '/forbidden') return NextResponse.next();

  const permissions = Array.isArray(token.permissions) ? token.permissions : [];
  if (permissions.includes(FLEET_READ_PERMISSION)) return NextResponse.next();

  if (isApi(pathname)) {
    return NextResponse.json({ code: 'FLEET_NO_READ' }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/forbidden';
  url.search = '';
  return NextResponse.rewrite(url);
}

export const config = {
  // Framework assets, the Shell's auth endpoints and the health probe are left
  // alone. The probe must answer without a session, or the cluster sees a
  // redirect and restarts a healthy pod. '/' is listed on its own: with a
  // basePath the second pattern does not match the bare zone root, which would
  // otherwise be served with no guard.
  matcher: ['/', '/((?!_next/static|_next/image|api/auth|api/health|favicon.ico).*)'],
};
