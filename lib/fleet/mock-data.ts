import type {
  Agent,
  AgentDay,
  CapacityPoint,
  Lookup,
  ReleaseCount,
} from './types';

/**
 * STAGE-1 MOCK DATA. Everything in this file is synthetic.
 *
 * - Names are invented and do not describe any real person.
 * - National ids are all-zero placeholders and emails use the reserved
 *   `.invalid` domain, so neither can ever resolve to anything real.
 * - Agent ids are UUID version 7, as the entity's ids will be.
 * - Activity figures are produced by a fixed-seed generator: the same
 *   numbers on every load, so reviewers see the same screen.
 *
 * Stage 3 replaces this module with calls to the Fleet service. The screens
 * read it only through the exported functions, never the arrays directly.
 */

export const MOCK_WEEK_START = '2026-09-21';

export const DEPARTMENTS: Lookup[] = [
  { id: 1, name: 'Leadership', isActive: true },
  { id: 2, name: 'Platform', isActive: true },
  { id: 3, name: 'Product', isActive: true },
  { id: 4, name: 'Service Desk', isActive: true },
  { id: 5, name: 'Compliance', isActive: true },
];

export const ROLES: Lookup[] = [
  { id: 1, name: 'Director', isActive: true },
  { id: 2, name: 'Advisor', isActive: true },
  { id: 3, name: 'Chief', isActive: true },
  { id: 4, name: 'Team Lead', isActive: true },
  { id: 5, name: 'Engineer', isActive: true },
  { id: 6, name: 'Specialist', isActive: true },
  { id: 7, name: 'Analyst', isActive: true },
  { id: 8, name: 'Assistant', isActive: true },
  { id: 9, name: 'Auditor', isActive: true },
];

export const PROJECTS: Lookup[] = [
  { id: 1, name: 'Project Alpha', isActive: true },
  { id: 2, name: 'Project Beta', isActive: true },
  { id: 3, name: 'Project Gamma', isActive: true },
  { id: 4, name: 'Project Delta', isActive: true },
];

const IDS = [
  '01a05bfb-7000-7b37-b592-17a54b626f95',
  '01a05bfb-73e8-72da-8e28-005a64051fc5',
  '01a05bfb-77d0-7476-9733-eb93b7e9ca56',
  '01a05bfb-7bb8-7a1c-8feb-ad9576ef9a2b',
  '01a05bfb-7fa0-7248-a2df-998356ae7b27',
  '01a05bfb-8388-7349-b419-caeb644fa474',
  '01a05bfb-8770-7b6d-b452-e7dcdefedff7',
  '01a05bfb-8b58-7f10-afea-ab38a2d2d59c',
  '01a05bfb-8f40-783f-8996-51c59316ae45',
  '01a05bfb-9328-719d-8c80-60cd4a1646a3',
  '01a05bfb-9710-764a-8a4c-b2c6d7b1d5ab',
  '01a05bfb-9af8-71da-b48a-d85bd65726d8',
  '01a05bfb-9ee0-701f-81dd-079cfcab72ed',
  '01a05bfb-a2c8-7d87-bb36-1d451289b39d',
  '01a05bfb-a6b0-7bba-b329-e6707271528e',
  '01a05bfb-aa98-7ef3-9ee6-1fa226a75f60',
  '01a05bfb-ae80-7d77-b3f0-44d98e914511',
  '01a05bfb-b268-7442-b829-4491b438eac5',
  '01a05bfb-b650-7d72-9a12-3099df938bbd',
  '01a05bfb-ba38-750f-b182-cabd5e61b724',
  '01a05bfb-be20-7933-8b51-5e2140ffc8c4',
  '01a05bfb-c208-7929-85dc-51c18cee7c1a',
  '01a05bfb-c5f0-7ccd-bb78-ed7b236983ac',
  '01a05bfb-c9d8-747d-a27c-ec47eadcb7b3',
  '01a05bfb-cdc0-7546-bb24-964a87bf5223',
  '01a05bfb-d1a8-7094-bcf5-0865dc51f352',
  '01a05bfb-d590-77bb-87c9-f4ac4c93dbb7',
  '01a05bfb-d978-7e82-a11e-45b30ec572ca',
];

// [firstName, lastName, roleId, departmentId, projectId, reportsTo (row index), isActive]
type Row = [string, string, number, number, number | null, number | null, boolean];

const ROWS: Row[] = [
  ['Ansel', 'Ashby', 1, 1, null, null, true],
  ['Brona', 'Brightwater', 2, 1, null, 0, true],
  ['Cato', 'Coldren', 3, 1, null, 0, true],
  ['Dara', 'Dunmore', 3, 1, null, 0, true],
  ['Elio', 'Everly', 4, 2, 1, 3, true],
  ['Fiora', 'Farrow', 4, 3, 2, 3, true],
  ['Garrin', 'Galloway', 4, 3, 3, 3, true],
  ['Halle', 'Hartwell', 4, 4, 4, 2, true],
  ['Ines', 'Ivers', 4, 5, null, 2, true],
  ['Jory', 'Jansen', 5, 2, 1, 4, true],
  ['Kiran', 'Kestrel', 5, 2, 1, 4, true],
  ['Lorne', 'Lowell', 5, 2, 1, 4, false],
  ['Maren', 'Marsh', 5, 3, 2, 5, true],
  ['Niko', 'Norwood', 5, 3, 2, 5, true],
  ['Oriel', 'Oakes', 5, 3, 2, 5, true],
  ['Pell', 'Pembroke', 5, 3, 2, 5, true],
  ['Quill', 'Quarry', 5, 3, 3, 6, true],
  ['Rhea', 'Ravel', 5, 3, 3, 6, true],
  ['Sable', 'Stroud', 5, 3, 3, 6, false],
  ['Tarin', 'Thorne', 6, 4, 4, 7, true],
  ['Ulla', 'Underhill', 6, 4, 4, 7, true],
  ['Veda', 'Vance', 6, 4, 4, 7, true],
  ['Wren', 'Whitlock', 6, 4, 4, 7, true],
  ['Xavi', 'Yardley', 6, 4, 4, 7, true],
  ['Yara', 'Zell', 7, 5, null, 8, true],
  ['Zeno', 'Aldous', 7, 5, null, 8, true],
  ['Alba', 'Bexley', 8, 1, null, 0, true],
  ['Bram', 'Crane', 9, 5, null, null, true],
];

export const AGENTS: Agent[] = ROWS.map(
  ([firstName, lastName, roleId, departmentId, projectId, reportsTo, isActive], i) => ({
    agentId: IDS[i],
    firstName,
    lastName,
    nationalId: `0000000${String(i + 1).padStart(3, '0')}`,
    roleId,
    departmentId,
    projectId,
    reportsToAgentId: reportsTo === null ? null : IDS[reportsTo],
    email: `${firstName}.${lastName}@example.invalid`.toLowerCase(),
    isActive,
  }),
);

/** Deterministic PRNG (mulberry32), so the mock is identical on every load. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const MOCK_DAYS: string[] = Array.from({ length: 7 }, (_, i) =>
  addDays(MOCK_WEEK_START, i),
);

// Heavier roles generate more activity, so the charts have a believable shape.
const ROLE_WEIGHT: Record<number, number> = {
  1: 0.5, 2: 0.3, 3: 0.7, 4: 0.9, 5: 1, 6: 0.8, 7: 0.6, 8: 0.4, 9: 0.3,
};

export const AGENT_DAYS: AgentDay[] = AGENTS.flatMap((agent, ai) =>
  MOCK_DAYS.map((day, di) => {
    const rnd = seeded(ai * 101 + di * 7 + 13);
    const w = agent.isActive ? ROLE_WEIGHT[agent.roleId] ?? 0.5 : 0;
    // Friday (index 4 from Monday) is a quiet day.
    const dayFactor = di === 4 ? 0.35 : di === 5 ? 0.6 : 1;
    const f = w * dayFactor;
    const n = (max: number) => Math.round(max * f * (0.5 + rnd()));
    const input = n(420_000);
    return {
      agentId: agent.agentId,
      day,
      messages: { inbound: n(18), outbound: n(22), internal: n(30), other: n(5) },
      toolCalls: { read: n(90), edit: n(40), search: n(55), shell: n(35), other: n(12) },
      sessionsOnline: agent.isActive ? Math.max(1, n(3)) : 0,
      sessionsOffline: agent.isActive ? n(1) : 1,
      tokens: {
        input,
        output: Math.round(input * (0.08 + rnd() * 0.05)),
        cacheWrite: Math.round(input * (0.3 + rnd() * 0.2)),
        cacheRead: Math.round(input * (2.5 + rnd() * 1.5)),
      },
      activeMinutes: n(260),
    };
  }),
);

export const CAPACITY: CapacityPoint[] = Array.from({ length: 28 }, (_, i) => {
  const rnd = seeded(9000 + i);
  const at = new Date(Date.UTC(2026, 8, 21, 0, 0, 0) + i * 6 * 3600_000).toISOString();
  return {
    at,
    fiveHourPct: Math.round(10 + rnd() * 55),
    sevenDayPct: Math.round(6 + i * 2.1 + rnd() * 2),
    payloadAgeMin: Math.round(1 + rnd() * 38),
  };
});

export const RELEASES: ReleaseCount[] = [
  { service: 'svc-alpha', releases: 6 },
  { service: 'svc-beta', releases: 4 },
  { service: 'svc-gamma', releases: 2 },
  { service: 'svc-delta', releases: 3 },
  { service: 'gateway', releases: 1 },
  { service: 'web-zones', releases: 5 },
];
