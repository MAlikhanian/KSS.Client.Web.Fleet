// Handler-level tests for the zone's Fleet data routes.
//
// These call the route logic DIRECTLY, with no middleware in front of it, so
// every refusal proven here is the route's own re-check, not the middleware's.
//
// Run: node --import ./tests/support/resolve-hooks.mjs --test tests/web-proxy.test.mjs
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import {
  PRIVATE_MARKER,
  TEST_ACCESS_TOKEN,
  TEST_SECRET,
  allKeys,
  leaksPrivate,
  sessionCookie,
  startMockFleet,
} from './support/fixtures.mjs';

const { handleWebGet } = await import('../lib/fleet/server/web-proxy.ts');

const ALLOWED_KEYS = {
  org: ['agents', 'departments', 'roles', 'projects', 'agentId', 'firstName', 'lastName', 'roleId', 'departmentId', 'projectId', 'reportsToAgentId', 'isActive', 'id', 'name'],
  presence: ['hasData', 'agents', 'agentId', 'online', 'lastBeatAt'],
  activity: ['from', 'to', 'rows', 'day', 'agentId', 'direction', 'count'],
};

let fleet;
before(async () => {
  fleet = await startMockFleet();
  process.env.NEXTAUTH_SECRET = TEST_SECRET;
  delete process.env.NEXTAUTH_URL;
});
after(async () => fleet.close());
beforeEach(() => {
  process.env.FLEET_API_BASE_URL = fleet.url;
  fleet.requests.length = 0;
  fleet.setOverride(null);
});

function request(path, cookie) {
  return new NextRequest(`http://localhost/fleet/api/fleet/${path}`, { headers: cookie ? { cookie } : {} });
}

async function call(route, path, cookie) {
  const res = await handleWebGet(route, request(path, cookie));
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}

describe('refusals happen in the route itself (no middleware in the path)', () => {
  for (const route of ['org', 'presence', 'activity']) {
    const path = route === 'activity' ? 'activity?from=2026-09-21&to=2026-09-27' : route;

    test(`${route}: no session -> 401, upstream never called`, async () => {
      const r = await call(route, path, null);
      assert.equal(r.status, 401);
      assert.equal(fleet.requests.length, 0);
    });

    test(`${route}: session WITHOUT Fleet.Read -> 403 FLEET_NO_READ, upstream never called`, async () => {
      const r = await call(route, path, await sessionCookie({ permissions: ['Dms.Read'] }));
      assert.equal(r.status, 403);
      assert.equal(r.json.code, 'FLEET_NO_READ');
      assert.equal(fleet.requests.length, 0);
    });

    test(`${route}: session with Fleet.Read but no access token -> 401`, async () => {
      const r = await call(route, path, await sessionCookie({ accessToken: null }));
      assert.equal(r.status, 401);
      assert.equal(fleet.requests.length, 0);
    });

    test(`${route}: expired Auth token -> 401`, async () => {
      const r = await call(route, path, await sessionCookie({ tokenExpires: '2020-01-01T00:00:00Z' }));
      assert.equal(r.status, 401);
      assert.equal(fleet.requests.length, 0);
    });

    test(`${route}: a cookie signed with another secret -> 401`, async () => {
      const good = await sessionCookie();
      process.env.NEXTAUTH_SECRET = 'a-different-synthetic-secret';
      try {
        const r = await call(route, path, good);
        assert.equal(r.status, 401);
      } finally {
        process.env.NEXTAUTH_SECRET = TEST_SECRET;
      }
    });
  }
});

describe('the upstream call is GET-only, fixed path, Bearer, no body', () => {
  for (const [route, path, upstreamPath] of [
    ['org', 'org', '/api/web/org'],
    ['presence', 'presence', '/api/web/presence'],
    ['activity', 'activity?from=2026-09-21&to=2026-09-27&agentId=injected&x=1', '/api/web/activity'],
  ]) {
    test(`${route}: forwards exactly one GET to ${upstreamPath}`, async () => {
      const r = await call(route, path, await sessionCookie());
      assert.equal(r.status, 200, r.text);
      assert.equal(fleet.requests.length, 1);
      const [up] = fleet.requests;
      assert.equal(up.method, 'GET');
      assert.equal(up.path, upstreamPath);
      assert.equal(up.authorization, `Bearer ${TEST_ACCESS_TOKEN}`);
      assert.equal(up.body, '');
      if (route === 'activity') assert.equal(up.query, '?from=2026-09-21&to=2026-09-27');
      else assert.equal(up.query, '');
    });
  }
});

describe('no private field reaches the browser (assert the payload)', () => {
  test('control: the mock upstream really does carry private fields', async () => {
    const raw = await fetch(`${fleet.url}/api/web/org`).then((r) => r.text());
    assert.ok(leaksPrivate(raw), 'detector must fire on the raw upstream body');
  });

  for (const [route, path] of [
    ['org', 'org'],
    ['presence', 'presence'],
    ['activity', 'activity?from=2026-09-21&to=2026-09-27'],
  ]) {
    test(`${route}: response carries only contract keys`, async () => {
      const r = await call(route, path, await sessionCookie());
      assert.equal(r.status, 200, r.text);
      assert.equal(leaksPrivate(r.text), false, `private data in ${route} payload`);
      assert.ok(!r.text.includes(TEST_ACCESS_TOKEN), 'the access token must never be echoed');
      const extra = [...allKeys(r.json)].filter((k) => !ALLOWED_KEYS[route].includes(k));
      assert.deepEqual(extra, [], `unexpected keys in ${route}: ${extra.join(', ')}`);
    });
  }

  test('activity: the folded "other" row (agentId null) is passed through as served', async () => {
    const r = await call('activity', 'activity?from=2026-09-21&to=2026-09-27', await sessionCookie());
    assert.ok(r.json.rows.some((row) => row.agentId === null && row.direction === 'in' && row.count === 4));
  });
});

describe('presence v1.1: "no data" can never become "everyone offline"', () => {
  test('hasData:false with an empty list is passed through', async () => {
    fleet.setOverride(() => ({ status: 200, body: { hasData: false, agents: [] } }));
    const r = await call('presence', 'presence', await sessionCookie());
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { hasData: false, agents: [] });
  });
  test('hasData:false WITH agents is contradictory and refused', async () => {
    fleet.setOverride(() => ({
      status: 200,
      body: { hasData: false, agents: [{ agentId: '01a05bfb-7000-7b37-b592-17a54b626f95', online: false, lastBeatAt: '2026-09-01T00:00:00Z' }] },
    }));
    const r = await call('presence', 'presence', await sessionCookie());
    assert.equal(r.status, 502);
    assert.equal(r.json.code, 'FLEET_BAD_RESPONSE');
  });
  test('a v1 body without hasData is refused, not guessed', async () => {
    fleet.setOverride(() => ({ status: 200, body: { agents: [] } }));
    const r = await call('presence', 'presence', await sessionCookie());
    assert.equal(r.status, 502);
  });
});

describe('activity range is validated before anything is forwarded', () => {
  for (const [label, qs] of [
    ['missing', ''],
    ['bad format', '?from=21-09-2026&to=2026-09-27'],
    ['impossible date', '?from=2026-02-30&to=2026-03-01'],
    ['from after to', '?from=2026-09-28&to=2026-09-27'],
    ['span over 93 days', '?from=2026-01-01&to=2026-04-04'],
  ]) {
    test(`${label} -> 422 FLEET_REQUEST_INVALID, upstream never called`, async () => {
      const r = await call('activity', `activity${qs}`, await sessionCookie());
      assert.equal(r.status, 422);
      assert.equal(r.json.code, 'FLEET_REQUEST_INVALID');
      assert.equal(fleet.requests.length, 0);
    });
  }

  test('span of exactly 93 days (to - from = 92) is accepted', async () => {
    const r = await call('activity', 'activity?from=2026-01-01&to=2026-04-03', await sessionCookie());
    assert.equal(r.status, 200, r.text);
  });
});

describe('upstream errors surface their FLEET_ code, never the token', () => {
  test('401 FLEET_TOKEN_INVALID is passed through, and logged without the token', async () => {
    fleet.setOverride(() => ({ status: 401, body: { code: 'FLEET_TOKEN_INVALID' } }));
    const logged = [];
    const original = console.error;
    console.error = (...args) => logged.push(args.join(' '));
    try {
      const r = await call('org', 'org', await sessionCookie());
      assert.equal(r.status, 401);
      assert.equal(r.json.code, 'FLEET_TOKEN_INVALID');
    } finally {
      console.error = original;
    }
    const log = logged.join('\n');
    assert.match(log, /FLEET_TOKEN_INVALID/);
    assert.ok(!log.includes(TEST_ACCESS_TOKEN), 'the token must never be logged');
  });

  test('a non-FLEET error body is not passed through verbatim', async () => {
    fleet.setOverride(() => ({ status: 500, body: { code: `<script>${PRIVATE_MARKER}`, detail: 'stack trace' } }));
    const r = await call('org', 'org', await sessionCookie());
    assert.equal(r.status, 502);
    assert.equal(r.json.code, 'FLEET_UPSTREAM_500');
    assert.ok(!r.text.includes(PRIVATE_MARKER));
  });

  test('a malformed success body is refused, not forwarded', async () => {
    fleet.setOverride(() => ({ status: 200, body: { agents: 'not-an-array', nationalId: PRIVATE_MARKER } }));
    const r = await call('org', 'org', await sessionCookie());
    assert.equal(r.status, 502);
    assert.equal(r.json.code, 'FLEET_BAD_RESPONSE');
    assert.ok(!r.text.includes(PRIVATE_MARKER));
  });

  test('unreachable upstream -> 502 FLEET_UNREACHABLE', async () => {
    process.env.FLEET_API_BASE_URL = 'http://127.0.0.1:1';
    const r = await call('org', 'org', await sessionCookie());
    assert.equal(r.status, 502);
    assert.equal(r.json.code, 'FLEET_UNREACHABLE');
  });

  test('FLEET_API_BASE_URL missing -> 500 FLEET_NOT_CONFIGURED, nothing sent', async () => {
    delete process.env.FLEET_API_BASE_URL;
    const r = await call('org', 'org', await sessionCookie());
    assert.equal(r.status, 500);
    assert.equal(r.json.code, 'FLEET_NOT_CONFIGURED');
    assert.equal(fleet.requests.length, 0);
  });
});
