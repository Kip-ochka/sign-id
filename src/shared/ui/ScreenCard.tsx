import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
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
  useEffect(() => heading.current?.focus(), [title]);
  return (
    <main className={styles.page}>
      <div className={styles.service}>Подписание документов</div>
      <article className={styles.card}>
        {indicator}
        {step && <p className={styles.step}>{step}</p>}
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {message && <p className={styles.message}>{message}</p>}
        {children}
      </article>
    </main>
  );
}
