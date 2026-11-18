import type { ReactNode } from 'react';
import * as css from './ContentWrapper.css';
export function ContentWrapper({ children }: { children: ReactNode }) {
  useStyles(css);
  return (
    <main className="sign">
      <article className="sign-content">{children}</article>
    </main>
  );
}
