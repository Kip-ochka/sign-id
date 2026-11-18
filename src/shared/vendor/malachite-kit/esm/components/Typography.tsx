import type { HTMLAttributes } from 'react';
import styles from '../../../Kit.module.css';
function Paragraph({
  className = '',
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={[styles.text, className].join(' ')} />;
}
export default { Paragraph };
