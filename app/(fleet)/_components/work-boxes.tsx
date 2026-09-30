'use client';

import { Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { lookupName } from '@/lib/fleet/org';
import type { Agent, OrgResponse } from '@/lib/fleet/web-contract';
import { Avatar, MiniBars } from './fleet-ui';
import { buildOrgBoxes, isLeadershipRole } from './org-boxes';
import { useFleet } from './use-fleet';

export interface AgentWork {
  sent: number;
  received: number;
  /** Per day of the period, oldest first. */
  daily: number[];
}

/**
 * Work as the same dense team boxes as the org screen: Leadership first, then
 * one box per engineering project and one per other department. Each box has a
 * one-line summary (count, daily bars, sent / received) and one line per agent.
 * A box with nobody left after the filters is not shown.
 */
export function WorkBoxes({
  org,
  work,
  included,
  days,
  other,
}: {
  org: OrgResponse;
  work: Map<string, AgentWork>;
  included: (a: Agent) => boolean;
  days: number;
  other: { present: boolean; sent: number; received: number };
}) {
  const { t, num, name, roleName, departmentName } = useFleet();
  const layout = buildOrgBoxes(org);
  const zero: AgentWork = { sent: 0, received: 0, daily: Array(days).fill(0) };

  const boxes = [
    {
      key: 'lead',
      title: t('org.leadership'),
      bar: 'bg-primary',
      text: 'text-foreground',
      members: layout.strip,
      strip: true,
    },
    ...layout.boxes.map((b) => ({
      key: b.key,
      title: `${b.department !== null ? departmentName(b.title) : b.title}${b.noProject ? ` · ${t('common.noProject')}` : ''}`,
      bar: b.style.bar,
      text: b.style.text,
      members: [...b.leads, ...b.rest.map((r) => r.agent)],
      strip: false,
    })),
  ]
    .map((b) => {
      const members = b.members.filter(included).map((a) => ({ agent: a, w: work.get(a.agentId) ?? zero }));
      const sent = members.reduce((acc, m) => acc + m.w.sent, 0);
      const received = members.reduce((acc, m) => acc + m.w.received, 0);
      const daily = Array.from({ length: days }, (_, i) => members.reduce((acc, m) => acc + (m.w.daily[i] ?? 0), 0));
      return { ...b, members, sent, received, daily };
    })
    .filter((b) => b.members.length > 0);

  return (
    <div className="[column-gap:0.75rem] [column-width:14rem]" data-testid="fleet-work-departments">
      {boxes.map((b) => (
        <Card key={b.key} className="mb-3 break-inside-avoid overflow-hidden" data-testid="fleet-work-box">
          <div className={cn('h-0.5', b.bar)} />
          <div className="flex min-w-0 items-center justify-between gap-2 px-3 pt-2">
            <h3 className={cn('min-w-0 break-words text-sm font-semibold', b.text)}>
              <bdi>{b.title}</bdi> · <bdi>{num(b.members.length)}</bdi>
            </h3>
            <MiniBars values={b.daily} bar={b.bar} className="h-5 w-14" />
          </div>
          <p className="px-3 pb-1 text-xs tabular-nums text-muted-foreground">
            {t('work.sent')} <b className="font-semibold text-foreground">{num(b.sent)}</b> · {t('work.received')}{' '}
            <b className="font-semibold text-foreground">{num(b.received)}</b>
          </p>
          <ul className="flex flex-col px-1 pb-1.5">
            {b.members.map(({ agent, w }) => (
              <li key={agent.agentId} className="flex min-w-0 items-start gap-2 rounded-md px-2 py-0.5">
                <Avatar agent={agent} size="xs" />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-[13px] leading-5">
                  <bdi className="min-w-0 break-words text-foreground">{name(agent)}</bdi>
                  <span className="min-w-0 break-words text-muted-foreground">
                    {b.strip && !isLeadershipRole(org, agent)
                      ? departmentName(lookupName(org.departments, agent.departmentId))
                      : roleName(lookupName(org.roles, agent.roleId))}
                  </span>
                </span>
                <span className="shrink-0 text-xs leading-5 tabular-nums text-muted-foreground">
                  <span className="text-foreground">{num(w.sent)}</span> · {num(w.received)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {other.present ? (
        <Card className="mb-3 break-inside-avoid border-dashed shadow-none" data-testid="fleet-other-card">
          <div className="flex flex-col gap-1 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Info className="size-3.5 shrink-0" />
              {t('work.otherTitle')}
            </span>
            <span>{t('work.otherBody')}</span>
            <span className="tabular-nums">
              {t('work.sent')} <b className="font-semibold text-foreground">{num(other.sent)}</b> · {t('work.received')}{' '}
              <b className="font-semibold text-foreground">{num(other.received)}</b>
            </span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
