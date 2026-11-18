import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import Typography from '@sber-site/malachite-kit/esm/components/Typography';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';
import { ContentWrapper } from './ContentWrapper';
import styles from './Screen.module.css';
export function ScreenCard({
  title,
  message,
  step,
  indicator,
  children,
}: {
  title: string;
  message?: string;
  step?: string;
  indicator?: ReactNode;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { isDesktop } = useBreakpoints();
  useEffect(() => heading.current?.focus(), [title]);
  return (
    <ContentWrapper>
      <div className={styles.card}>
        {step && (
          <div className={styles.step}>
            <Typography.Paragraph>{step}</Typography.Paragraph>
          </div>
        )}
        {indicator}
        <Heading
          tag="h1"
          size={isDesktop ? 'h2' : 'h3'}
          ref={heading}
          tabIndex={-1}
        >
          {title}
        </Heading>
        {message && (
          <Text tag="p" className={styles.message}>
            {message}
          </Text>
        )}
        {children}
      </div>
    </ContentWrapper>
  );
}
