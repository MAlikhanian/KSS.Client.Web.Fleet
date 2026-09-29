'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrgNode } from '@/lib/fleet/queries';
import type { Agent } from '@/lib/fleet/types';
import { useFleet } from './use-fleet';

// One accent per department, so a department reads at a glance across the tree.
const DEPT_ACCENT: Record<number, string> = {
  1: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  2: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  3: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  4: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  5: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

export function AgentCard({
  agent,
  dimmed,
  reportsCount,
  className,
}: {
  agent: Agent;
  dimmed?: boolean;
  reportsCount?: number;
  className?: string;
}) {
  const { t, num, dept, role, project, name } = useFleet();
  const initials = `${agent.firstName[0] ?? ''}${agent.lastName[0] ?? ''}`;

  return (
    <div
      data-testid="fleet-agent-card"
      className={cn(
        'flex w-56 items-start gap-2.5 rounded-lg border bg-card p-2.5 text-start shadow-xs transition-opacity',
        !agent.isActive && 'border-dashed bg-muted/40',
        dimmed && 'opacity-30',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          DEPT_ACCENT[agent.departmentId],
          !agent.isActive && 'grayscale',
        )}
      >
        {initials}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{name(agent)}</span>
        <span className="truncate text-xs text-muted-foreground">
          {role(agent.roleId)} · {dept(agent.departmentId)}
        </span>
        <span className="truncate text-xs text-muted-foreground">{project(agent.projectId)}</span>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {!agent.isActive ? (
            <Badge variant="secondary" appearance="light" size="xs">
              {t('common.inactive')}
            </Badge>
          ) : null}
          {reportsCount ? (
            <Badge variant="primary" appearance="light" size="xs">
              {t('org.directReports', { count: num(reportsCount) })}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * One subtree. Children that manage people are laid out side by side under a
 * connector; a list of people who manage nobody is stacked vertically, which
 * keeps a wide team from pushing the chart off the screen.
 */
export function OrgSubtree({
  node,
  isMatch,
}: {
  node: OrgNode;
  isMatch: (a: Agent) => boolean;
}) {
  const kids = node.children;
  const branch = kids.filter((k) => k.children.length > 0);
  const leaves = kids.filter((k) => k.children.length === 0);

  return (
    <div className="flex flex-col items-center">
      <AgentCard agent={node.agent} dimmed={!isMatch(node.agent)} reportsCount={kids.length} />

      {kids.length > 0 ? <span aria-hidden className="h-5 w-px bg-border" /> : null}

      {leaves.length > 0 ? (
        <div className="flex flex-col gap-2 border-s-2 border-border ps-3">
          {leaves.map((leaf) => (
            <AgentCard key={leaf.agent.agentId} agent={leaf.agent} dimmed={!isMatch(leaf.agent)} />
          ))}
        </div>
      ) : null}

      {branch.length > 0 && leaves.length > 0 ? (
        <span aria-hidden className="h-5 w-px bg-border" />
      ) : null}

      {branch.length > 0 ? (
        <div className="flex items-start">
          {branch.map((child) => (
            <div
              key={child.agent.agentId}
              className={cn(
                'relative flex flex-col items-center px-3 pt-5',
                'before:absolute before:top-0 before:left-1/2 before:h-5 before:w-px before:bg-border',
                'after:absolute after:top-0 after:inset-x-0 after:h-px after:bg-border',
                'first:after:start-1/2 last:after:end-1/2',
              )}
            >
              <OrgSubtree node={child} isMatch={isMatch} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
