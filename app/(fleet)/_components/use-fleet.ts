'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { Agent } from '@/lib/fleet/types';

/**
 * Translation and formatting shared by every Fleet screen.
 *
 * Lookup names (department, role, project) are translated by id from the
 * zone's own 'fleet' namespace; the English name in the mock is the fallback.
 */
export function useFleet() {
  const { t, i18n } = useTranslation('fleet');
  const lang = i18n.language?.startsWith('en') ? 'en' : 'fa';
  const locale = lang === 'fa' ? 'fa-IR' : 'en-GB';

  const num = useCallback((n: number) => n.toLocaleString(locale), [locale]);

  const compact = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n),
    [locale],
  );

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

  const dateTime = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(locale, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
    [locale],
  );

  const dept = useCallback(
    (id: number | null | undefined, fallback = '') =>
      id ? t(`lookup.department.${id}`, { defaultValue: fallback }) : fallback,
    [t],
  );
  const role = useCallback(
    (id: number | null | undefined, fallback = '') =>
      id ? t(`lookup.role.${id}`, { defaultValue: fallback }) : fallback,
    [t],
  );
  const project = useCallback(
    (id: number | null | undefined) =>
      id ? t(`lookup.project.${id}`) : t('common.noProject'),
    [t],
  );

  const name = useCallback((a: Pick<Agent, 'firstName' | 'lastName'>) => `${a.firstName} ${a.lastName}`, []);

  return { t, lang, locale, num, compact, day, dateTime, dept, role, project, name };
}
