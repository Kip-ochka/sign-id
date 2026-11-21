import type { ButtonHTMLAttributes } from 'react';
import './Button.css';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  theme?: 'primary' | 'secondary';
  size?: 'large' | 'medium';
  loading?: boolean;
};
export default function Button({
  loading,
  theme = 'primary',
  size = 'large',
  className = '',
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      aria-busy={loading || undefined}
      {...props}
      type={type}
      className={[
        'digital_id_sign_kit_button',
        `digital_id_sign_kit_${theme}`,
        `digital_id_sign_kit_${size}`,
        className,
      ].join(' ')}
    />
  );
}
