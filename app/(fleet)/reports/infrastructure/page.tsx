'use client';

import { Container } from '@/components/common/container';
import { NoSourceCard } from '../../_components/cards';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

/**
 * None of these figures has a source the Fleet service can read yet, so each is
 * shown as "no data source yet" with no number.
 */
export default function InfrastructureReportPage() {
  const { t } = useFleet();
  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('infra.title')} description={t('infra.description')} />
        <div className="grid gap-4 md:grid-cols-2">
          <NoSourceCard title={t('infra.capacityTitle')} />
          <NoSourceCard title={t('infra.releasesTitle')} />
          <NoSourceCard title={t('infra.mcpTitle')} />
          <NoSourceCard title={t('infra.rollbacksTitle')} />
        </div>
      </div>
    </Container>
  );
}
