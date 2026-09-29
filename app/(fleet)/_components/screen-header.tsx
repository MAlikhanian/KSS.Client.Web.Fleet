'use client';

import { type ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';
import { useFleet } from './use-fleet';

/**
 * Title, description and the sample-data notice every Fleet screen carries.
 *
 * The notice is part of the screen, not of a deploy note: stage 1 is shown to
 * reviewers, and a reviewer must be TOLD the figures are invented rather than
 * left to assume it.
 */
export function ScreenHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  const { t } = useFleet();
  return (
    <div className="flex flex-col gap-3 pb-5">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarTitle>{title}</ToolbarTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </ToolbarHeading>
        {actions ? <ToolbarActions>{actions}</ToolbarActions> : null}
      </Toolbar>
      <div
        role="note"
        data-testid="fleet-mock-banner"
        className="flex items-center gap-2 rounded-md border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <FlaskConical className="size-4 shrink-0" />
        <span>{t('common.mockBanner')}</span>
      </div>
    </div>
  );
}
