// HTTP-level tests against the production build (`next build` first).
//
// Starts `next start` on a free local port with a synthetic secret and a mock
// Fleet upstream, exercises the middleware and the routes through real HTTP,
// then stops the server. Nothing is left running.
//
// Run: node --import ./tests/support/resolve-hooks.mjs --test tests/http.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_SECRET, leaksPrivate, sessionCookie, startMockFleet } from './support/fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = ['org', 'presence', 'activity?from=2026-09-21&to=2026-09-27'];

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

let fleet;
let server;
let base;
let withRead;
let withoutRead;

before(async () => {
  assert.ok(existsSync(path.join(ROOT, '.next', 'BUILD_ID')), 'run `next build` before the HTTP tests');
  fleet = await startMockFleet();
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, NEXTAUTH_SECRET: TEST_SECRET, FLEET_API_BASE_URL: fleet.url, NODE_ENV: 'production' };
  delete env.NEXTAUTH_URL;
  server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/fleet/api/health`);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  withRead = await sessionCookie();
  withoutRead = await sessionCookie({ permissions: ['Dms.Read'] });
});

after(async () => {
  if (server) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fleet) await fleet.close();
});

const get = (p, cookie, init = {}) =>
  fetch(`${base}${p}`, { redirect: 'manual', ...init, headers: { ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) } });

describe('health stays outside the guard', () => {
  test('GET /fleet/api/health with no session -> 200', async () => {
    const r = await get('/fleet/api/health');
    assert.equal(r.status, 200);
  });
});

describe('middleware: no session', () => {
  for (const route of ROUTES) {
    test(`API /fleet/api/fleet/${route} -> 401`, async () => {
      const r = await get(`/fleet/api/fleet/${route}`);
      assert.equal(r.status, 401);
    });
  }
  for (const page of ['/fleet', '/fleet/reports/work', '/fleet/reports/tokens']) {
    test(`page ${page} -> 307 to /signin`, async () => {
      const r = await get(page);
      assert.equal(r.status, 307);
      assert.match(r.headers.get('location') ?? '', /\/signin\?callbackUrl=/);
    });
  }
});

describe('middleware: session WITHOUT Fleet.Read', () => {
  for (const route of ROUTES) {
    test(`API /fleet/api/fleet/${route} -> 403 FLEET_NO_READ`, async () => {
      const r = await get(`/fleet/api/fleet/${route}`, withoutRead);
      assert.equal(r.status, 403);
      assert.equal((await r.json()).code, 'FLEET_NO_READ');
    });
  }
  test('page /fleet -> the forbidden page, not the screens', async () => {
    const r = await get('/fleet', withoutRead);
    assert.equal(r.status, 200);
    const html = await r.text();
    // The marker is rendered by a server component, so it is in the server
    // payload whether or not the client guard has finished loading.
    assert.match(html, /fleet-forbidden/);
  });
  test('control: an allowed session does NOT get the forbidden page', async () => {
    const html = await (await get('/fleet', withRead)).text();
    assert.doesNotMatch(html, /fleet-forbidden/);
  });
  test('the mock upstream was never called by any of the above', () => {
    assert.equal(fleet.requests.length, 0);
  });
});

describe('session WITH Fleet.Read', () => {
  for (const route of ROUTES) {
    test(`API /fleet/api/fleet/${route} -> 200 with no private data`, async () => {
      const r = await get(`/fleet/api/fleet/${route}`, withRead);
      assert.equal(r.status, 200);
      assert.equal(leaksPrivate(await r.text()), false);
    });
  }
  test('page /fleet -> 200', async () => {
    const r = await get('/fleet', withRead);
    assert.equal(r.status, 200);
  });
});

describe('a signed-in application is never indexed', () => {
  for (const [label, p, cookie] of [
    ['allowed page', '/fleet', 'withRead'],
    ['allowed report page', '/fleet/reports/work', 'withRead'],
    ['refused page (no session, 307)', '/fleet', null],
    ['forbidden page (no permission)', '/fleet', 'withoutRead'],
    ['API route', '/fleet/api/fleet/org', 'withRead'],
  ]) {
    test(`${label}: X-Robots-Tag noindex`, async () => {
      const c = cookie === 'withRead' ? withRead : cookie === 'withoutRead' ? withoutRead : undefined;
      const r = await get(p, c);
      assert.match(r.headers.get('x-robots-tag') ?? '', /noindex/);
    });
  }
  test('allowed page: <meta name="robots" content="noindex, nofollow"> in the HTML', async () => {
    const html = await (await get('/fleet', withRead)).text();
    assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  });
});

describe('humans are read-only: every non-GET is refused on every route', () => {
  for (const route of ROUTES) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      test(`${method} /fleet/api/fleet/${route} -> 405`, async () => {
        const before = fleet.requests.length;
        const r = await get(`/fleet/api/fleet/${route}`, withRead, { method, body: method === 'DELETE' ? undefined : '{"x":1}', headers: { 'content-type': 'application/json' } });
        assert.equal(r.status, 405);
        assert.equal(fleet.requests.length, before, 'nothing may reach the upstream');
      });
    }
  }
});

describe('fixed allow-list: no other upstream path is reachable', () => {
  for (const p of ['/fleet/api/fleet/memory', '/fleet/api/fleet/messages', '/fleet/api/fleet/org/extra', '/fleet/api/web/org']) {
    test(`${p} -> 404`, async () => {
      const r = await get(p, withRead);
      assert.equal(r.status, 404);
    });
  }
});

describe('source: route files export GET only', () => {
  const dir = path.join(ROOT, 'app', 'api', 'fleet');
  const files = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('route.ts'));
  test('exactly three route files exist', () => {
    assert.deepEqual(files.map(String).sort(), ['activity\\route.ts', 'org\\route.ts', 'presence\\route.ts'].map((f) => f.split('\\').join(path.sep)).sort());
  });
  for (const f of files) {
    test(`${f} exports GET and nothing else`, () => {
      const src = readFileSync(path.join(dir, String(f)), 'utf8');
      const exported = [...src.matchAll(/export\s+(?:async\s+)?(?:const|function|let)\s+(\w+)|export\s*\{([^}]*)\}/g)]
        .flatMap((m) => (m[1] ? [m[1]] : m[2].split(',').map((s) => s.trim().split(/\s+as\s+/).pop())))
        .filter(Boolean);
      assert.deepEqual(exported.filter((n) => n !== 'dynamic'), ['GET']);
    });
  }
});
