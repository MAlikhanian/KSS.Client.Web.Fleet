'use client';

import { Container } from '@/components/common/container';
import { NoSourceCard } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

/** No source records active hours yet: this screen says so and shows no figures. */
export default function HoursReportPage() {
  const { t } = useFleet();
  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('hours.title')} description={t('hours.description')} />
        <NoSourceCard title={t('hours.sourceTitle')} />
      </div>
    </Container>
  );
}
