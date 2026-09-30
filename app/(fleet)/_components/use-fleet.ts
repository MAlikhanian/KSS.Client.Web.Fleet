'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { Agent } from '@/lib/fleet/web-contract';

/**
 * Translation and formatting shared by every Fleet screen.
 *
 * Department, role and project NAMES are data from the Fleet service and are
 * shown as served; only the interface text is translated.
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

  return { t, lang, locale, num, day, name };
}
