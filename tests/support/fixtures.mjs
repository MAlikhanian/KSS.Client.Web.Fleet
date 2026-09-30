// Shared test fixtures. Every value here is synthetic.
import http from 'node:http';
import { encode } from 'next-auth/jwt';

/** A test-only secret. It is not, and must never be, a real deployment value. */
export const TEST_SECRET = 'fleet-zone-test-secret-synthetic-0001';

/** A fake upstream bearer token. Used to assert it is forwarded, never echoed. */
export const TEST_ACCESS_TOKEN = 'synthetic-upstream-token-7c1e';

/**
 * Fields the zone must never pass to the browser. The mock upstream adds every
 * one of them to every response, so a zone that forwards bodies verbatim fails.
 */
export const PRIVATE_FIELDS = ['nationalId', 'email', 'folder', 'sessionRef', 'body', 'subject'];
export const PRIVATE_MARKER = 'PRIVATE-MARKER-01a0d1e2-7f00-7abc-8def-0123456789ab';

export async function sessionCookie({ permissions = ['Fleet.Read'], accessToken = TEST_ACCESS_TOKEN, tokenExpires } = {}) {
  const token = { sub: 'synthetic-user', name: 'Synthetic Reviewer', permissions, roles: [] };
  if (accessToken !== null) token.accessToken = accessToken;
  if (tokenExpires) token.tokenExpires = tokenExpires;
  const value = await encode({ token, secret: TEST_SECRET });
  return `next-auth.session-token=${value}`;
}

const AGENT_A = '01a05bfb-7000-7b37-b592-17a54b626f95';
const AGENT_B = '01a05bfb-73e8-72da-8e28-005a64051fc5';

function withPrivate(obj) {
  const extra = {};
  for (const f of PRIVATE_FIELDS) extra[f] = PRIVATE_MARKER;
  return { ...obj, ...extra };
}

export const UPSTREAM = {
  '/api/web/org': () =>
    withPrivate({
      agents: [
        withPrivate({ agentId: AGENT_A, firstName: 'Ansel', lastName: 'Ashby', roleId: 1, departmentId: 1, projectId: null, reportsToAgentId: null, isActive: true }),
        withPrivate({ agentId: AGENT_B, firstName: 'Brona', lastName: 'Brightwater', roleId: 2, departmentId: 1, projectId: 1, reportsToAgentId: AGENT_A, isActive: false }),
      ],
      departments: [withPrivate({ id: 1, name: 'Leadership', isActive: true })],
      roles: [withPrivate({ id: 1, name: 'Director', isActive: true }), { id: 2, name: 'Advisor', isActive: true }],
      projects: [withPrivate({ id: 1, name: 'Project Alpha', isActive: true })],
    }),
  '/api/web/presence': () =>
    withPrivate({ hasData: true, agents: [withPrivate({ agentId: AGENT_A, online: true, lastBeatAt: '2026-09-30T05:00:00Z' })] }),
  '/api/web/activity': (url) =>
    withPrivate({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      rows: [
        withPrivate({ day: '2026-09-21', agentId: AGENT_A, direction: 'out', count: 7 }),
        withPrivate({ day: '2026-09-21', agentId: null, direction: 'in', count: 4 }),
      ],
    }),
};

/** Recursively lists every key in a JSON value. */
export function allKeys(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

/** True when a serialised payload carries any private field or the marker. */
export function leaksPrivate(text) {
  if (text.includes(PRIVATE_MARKER)) return true;
  return PRIVATE_FIELDS.some((f) => text.includes(`"${f}"`));
}

/**
 * A mock Fleet service. Records every request it receives; answers from
 * UPSTREAM, or with `override(path)` when a test sets one.
 */
export async function startMockFleet() {
  const requests = [];
  let override = null;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1');
      requests.push({ method: req.method, path: url.pathname, query: url.search, authorization: req.headers.authorization ?? null, body });
      const forced = override?.(url.pathname);
      if (forced) {
        res.writeHead(forced.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(forced.body));
        return;
      }
      const make = UPSTREAM[url.pathname];
      if (!make) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(make(url)));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    setOverride(fn) {
      override = fn;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
