'use client';

import { Container } from '@/components/common/container';
import { NoSourceScreen } from '../../_components/fleet-ui';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

/**
 * No source records active hours yet, so this screen shows exactly that and no
 * figures. Invented numbers on a live screen would read as real.
 */
export default function HoursReportPage() {
  const { t } = useFleet();
  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('hours.title')} description={t('hours.description')} />
        <NoSourceScreen coming={[t('hours.comingDaily'), t('hours.comingDept'), t('hours.comingTrend')]} />
      </div>
    </Container>
  );
}
