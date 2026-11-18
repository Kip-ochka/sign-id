import type { AnchorHTMLAttributes } from 'react';
import styles from '../Kit.module.css';
export function Link({
  theme,
  className = '',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { theme?: 'secondary' }) {
  return (
    <a
      data-theme={theme}
      {...props}
      className={[styles.link, className].join(' ')}
    />
  );
}
