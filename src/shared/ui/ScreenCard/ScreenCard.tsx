import type { ReactNode } from 'react';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { ContentWrapper } from '../ContentWrapper';
// TODO: заменить неоформленный каркас STATUS после предоставления готового дизайна.
export function ScreenCard({
  title,
  message,
  indicator,
  children,
}: {
  title: string;
  message?: string;
  indicator?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ContentWrapper>
      <section>
        {indicator}
        <Heading tag="h1" size="h3">
          {title}
        </Heading>
        {message && <Text tag="p">{message}</Text>}
        {children}
      </section>
    </ContentWrapper>
  );
}
