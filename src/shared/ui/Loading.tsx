import type { ReactNode } from 'react';
import loader from '../assets/loader.svg';
import styles from './Screen.module.css';
export function Loading({ children }: { children: ReactNode }) {
  return (
    <span className={styles.loading} role="status">
      <img className={styles.spinner} src={loader} alt="" />
      {children}
    </span>
  );
}
