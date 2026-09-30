'use client';

import { Container } from '@/components/common/container';
import { NoSourceScreen } from '../../_components/fleet-ui';
import { ScreenHeader } from '../../_components/screen-header';
import { useFleet } from '../../_components/use-fleet';

/**
 * None of these figures has a source the Fleet service can read yet, so the
 * screen says so, lists what will appear, and shows no number.
 */
export default function InfrastructureReportPage() {
  const { t } = useFleet();
  return (
    <Container>
      <div className="flex flex-col gap-5">
        <ScreenHeader title={t('infra.title')} description={t('infra.description')} />
        <NoSourceScreen
          coming={[t('infra.capacityTitle'), t('infra.releasesTitle'), t('infra.mcpTitle'), t('infra.rollbacksTitle')]}
        />
      </div>
    </Container>
  );
}
