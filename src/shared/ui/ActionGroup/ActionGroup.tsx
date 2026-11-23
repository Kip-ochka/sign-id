import type { ReactNode } from 'react';

import * as css from './ActionGroup.css';

export function ActionGroup({ children, className }: { children: ReactNode; className?: string }) {
    useStyles(css);
    return <div className={className ? `sign_actions ${className}` : 'sign_actions'}>{children}</div>;
}
