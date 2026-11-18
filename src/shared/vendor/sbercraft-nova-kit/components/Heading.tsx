import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from '../../Kit.module.css';
type Props = HTMLAttributes<HTMLHeadingElement> & {
  size?: 'h2' | 'h3';
  tag?: 'h1' | 'h2' | 'h3';
};
export default forwardRef<HTMLHeadingElement, Props>(function Heading(
  { tag: Tag = 'h2', size = 'h2', className = '', ...props },
  ref,
) {
  return (
    <Tag
      {...props}
      ref={ref}
      className={[styles.heading, styles[size], className].join(' ')}
    />
  );
});
