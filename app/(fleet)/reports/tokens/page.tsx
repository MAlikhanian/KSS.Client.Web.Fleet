'use client';

import { Container } from '@/components/common/container';
import { NoSourceCard } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

/**
 * No source records token usage yet, so this screen shows exactly that and no
 * figures. Invented numbers on a live screen would read as real.
 */
export default function TokensReportPage() {
  const { t } = useFleet();
  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('tokens.title')} description={t('tokens.description')} />
        <NoSourceCard title={t('tokens.sourceTitle')} />
      </div>
    </Container>
  );
}
