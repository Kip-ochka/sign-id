import type { ButtonHTMLAttributes } from 'react';
import styles from '../../../Kit.module.css';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  theme?: 'primary' | 'secondary';
  size?: 'large' | 'medium';
};
export default function Button({
  theme = 'primary',
  size = 'large',
  className = '',
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      className={[styles.button, styles[theme], styles[size], className].join(
        ' ',
      )}
    />
  );
}
