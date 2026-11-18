import type { HTMLAttributes } from 'react';
import styles from '../../Kit.module.css';
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
      className={[styles.text, styles[size], className].join(' ')}
    />
  );
}
