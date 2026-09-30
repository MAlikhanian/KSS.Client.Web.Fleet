'use client';

import { ShieldAlert } from 'lucide-react';
import { Container } from '@/components/common/container';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';

export function ForbiddenNotice() {
  const { t } = useTranslation('fleet');
  return (
    <Container>
      <Card>
        <CardContent className="flex items-start gap-3 py-6">
          <ShieldAlert className="size-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-foreground">{t('access.deniedTitle')}</span>
            <span className="text-sm text-muted-foreground">{t('access.deniedBody')}</span>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
