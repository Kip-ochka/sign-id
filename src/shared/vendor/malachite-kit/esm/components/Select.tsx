import type { Ref, SelectHTMLAttributes } from 'react';
import styles from '../../../Kit.module.css';
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  data: readonly { id: string; value: string; text: string }[];
  placeholder?: string;
  inputRef?: Ref<HTMLSelectElement>;
};
export default function Select({
  data,
  placeholder = 'Выберите значение',
  inputRef,
  className = '',
  ...props
}: Props) {
  return (
    <select
      {...props}
      ref={inputRef}
      className={[styles.select, className].join(' ')}
    >
      <option value="">{placeholder}</option>
      {data.map(({ id, value, text }) => (
        <option key={id} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}
