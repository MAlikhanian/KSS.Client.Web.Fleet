'use client';

import { type ReactNode } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';

/** Title and description every Fleet screen carries. */
export function ScreenHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Toolbar>
      <ToolbarHeading>
        <ToolbarTitle>{title}</ToolbarTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </ToolbarHeading>
      {actions ? <ToolbarActions>{actions}</ToolbarActions> : null}
    </Toolbar>
  );
}
