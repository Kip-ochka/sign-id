import type { HTMLAttributes } from 'react';

import '../../../sbercraft-nova-kit/components/Text.css';
function Paragraph({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
    return <p {...props} className={['digital_id_sign_kit_text', className].join(' ')} />;
}
export default { Paragraph };
