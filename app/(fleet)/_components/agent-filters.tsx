'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listDepartments, listProjects, type AgentFilter } from '@/lib/fleet/queries';
import { useFleet } from './use-fleet';

const ALL = 'all';

/** Department / project / status filters, shared by every Fleet screen. */
export function AgentFilters({
  value,
  onChange,
  showStatus = true,
}: {
  value: AgentFilter;
  onChange: (next: AgentFilter) => void;
  showStatus?: boolean;
}) {
  const { t, dept, project } = useFleet();

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Select
        value={value.departmentId ? String(value.departmentId) : ALL}
        onValueChange={(v) => onChange({ ...value, departmentId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="w-44" aria-label={t('common.department')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('common.allDepartments')}</SelectItem>
          {listDepartments().map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>
              {dept(d.id, d.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.projectId ? String(value.projectId) : ALL}
        onValueChange={(v) => onChange({ ...value, projectId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="w-44" aria-label={t('common.project')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('common.allProjects')}</SelectItem>
          {listProjects().map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {project(p.id)}
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
