import type { ReactNode } from 'react';
import styles from './Screen.module.css';
export function Loading({ children }: { children: ReactNode }) {
  return (
    <span className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {children}
    </span>
  );
}
