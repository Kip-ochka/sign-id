import type { AnchorHTMLAttributes } from 'react';

import './Link.css';
export function Link({
    theme,
    className = '',
    ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { theme?: 'secondary' }) {
    return <a data-theme={theme} {...props} className={['digital_id_sign_kit_link', className].join(' ')} />;
}
