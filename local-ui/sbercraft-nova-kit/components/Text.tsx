import type { HTMLAttributes } from 'react';
import './Text.css';
type Props = HTMLAttributes<HTMLElement> & {
  tag?: 'p' | 'span' | 'div';
  size?: 'sm' | 'md';
};
export default function Text({
  tag: Tag = 'span',
  size = 'md',
  className = '',
  ...props
}: Props) {
  return (
    <Tag
      {...props}
      className={[
        'digital_id_sign_kit_text',
        `digital_id_sign_kit_${size}`,
        className,
      ].join(' ')}
    />
  );
}
