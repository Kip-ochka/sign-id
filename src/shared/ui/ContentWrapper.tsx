import type { ReactNode } from 'react';
import styles from './ContentWrapper.module.css';
export function ContentWrapper({ children }: { children: ReactNode }) {
  return (
    <main className={styles.sign}>
      <article className={styles['sign-content']}>{children}</article>
    </main>
  );
}
