'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { Agent } from '@/lib/fleet/web-contract';

/**
 * Translation and formatting shared by every Fleet screen.
 *
 * Department, role and project NAMES are data from the Fleet service. Project
 * names are shown as served; role and department names go through the name maps
 * in the fleet namespace (roleName / departmentName), falling back to the served
 * text when a name is not mapped.
 */
export function useFleet() {
  const { t, i18n } = useTranslation('fleet');
  const lang = i18n.language?.startsWith('en') ? 'en' : 'fa';
  const locale = lang === 'fa' ? 'fa-IR' : 'en-GB';

  const num = useCallback((n: number) => n.toLocaleString(locale), [locale]);

  const day = useCallback(
    (iso: string) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
    [locale],
  );

  const name = useCallback((a: Pick<Agent, 'firstName' | 'lastName'>) => `${a.firstName} ${a.lastName}`, []);

  /**
   * A role name for display: the served (English) name translated through the
   * fleet namespace's `roleNames` map, keyed by the served name exactly. Read as
   * a resource, not through t(), so a role name holding a dot or colon is still
   * one key. An unmapped role shows as served: never blank.
   */
  const roleNames = i18n.getResource(lang, 'fleet', 'roleNames') as Record<string, string> | undefined;
  const roleName = useCallback((served: string) => (roleNames && roleNames[served]) || served, [roleNames]);
  /** Same, for department names (the `departmentNames` map). */
  const departmentNames = i18n.getResource(lang, 'fleet', 'departmentNames') as Record<string, string> | undefined;
  const departmentName = useCallback((served: string) => (departmentNames && departmentNames[served]) || served, [departmentNames]);

  return { t, lang, locale, num, day, name, roleName, departmentName };
}
