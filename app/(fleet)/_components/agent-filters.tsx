'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentFilter } from '@/lib/fleet/org';
import type { Lookup } from '@/lib/fleet/web-contract';
import { useFleet } from './use-fleet';

const ALL = 'all';

/** Department / project / status filters over the org data from the service. */
export function AgentFilters({
  value,
  onChange,
  departments,
  projects,
  showStatus = true,
}: {
  value: AgentFilter;
  onChange: (next: AgentFilter) => void;
  departments: Lookup[];
  projects: Lookup[];
  showStatus?: boolean;
}) {
  const { t } = useFleet();

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Select
        value={value.departmentId ? String(value.departmentId) : ALL}
        onValueChange={(v) => onChange({ ...value, departmentId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="w-48" aria-label={t('common.department')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('common.allDepartments')}</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.projectId ? String(value.projectId) : ALL}
        onValueChange={(v) => onChange({ ...value, projectId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="w-48" aria-label={t('common.project')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('common.allProjects')}</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showStatus ? (
        <Select
          value={value.status ?? ALL}
          onValueChange={(v) => onChange({ ...value, status: v as AgentFilter['status'] })}
        >
          <SelectTrigger className="w-32" aria-label={t('common.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('common.statusAll')}</SelectItem>
            <SelectItem value="active">{t('common.statusActive')}</SelectItem>
            <SelectItem value="inactive">{t('common.statusInactive')}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
