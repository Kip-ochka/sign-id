import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import './Heading.css';
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
      className={[
        'digital_id_sign_kit_heading',
        `digital_id_sign_kit_${size}`,
        className,
      ].join(' ')}
    />
  );
});
