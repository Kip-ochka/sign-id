import type { ReactNode } from 'react';
import './ContentWrapper.css';
export function ContentWrapper({ children }: { children: ReactNode }) {
    return (
        <main className="sign">
            <article className="sign-content">{children}</article>
        </main>
    );
}
