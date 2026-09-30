'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Agent } from '@/lib/fleet/web-contract';
import { useFleet } from './use-fleet';

export interface AgentColumn<R> {
  key: string;
  header: string;
  value: (row: R) => string;
}

/**
 * A read-only per-agent table: name, department, then the given columns.
 * `footer` is an optional extra row (e.g. the service's grouped "other" counts),
 * rendered as served.
 */
export function AgentTable<R extends { agent: Agent }>({
  rows,
  columns,
  departmentName,
  footer,
}: {
  rows: R[];
  columns: AgentColumn<R>[];
  departmentName: (id: number) => string;
  footer?: { label: string; values: string[] } | null;
}) {
  const { t, name } = useFleet();

  if (rows.length === 0 && !footer) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('common.noAgents')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.agent')}</TableHead>
            <TableHead>{t('common.department')}</TableHead>
            {columns.map((c) => (
              <TableHead key={c.key} className="text-end">
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.agent.agentId} className={row.agent.isActive ? undefined : 'opacity-60'}>
              <TableCell className="font-medium">
                {name(row.agent)}
                {!row.agent.isActive ? (
                  <span className="ms-2 text-xs text-muted-foreground">({t('common.inactive')})</span>
                ) : null}
              </TableCell>
              <TableCell>{departmentName(row.agent.departmentId)}</TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} className="text-end tabular-nums">
                  {c.value(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {footer ? (
            <TableRow data-testid="fleet-other-row" className="bg-muted/40">
              <TableCell className="font-medium" colSpan={2}>
                {footer.label}
              </TableCell>
              {footer.values.map((v, i) => (
                <TableCell key={i} className="text-end tabular-nums">
                  {v}
                </TableCell>
              ))}
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
