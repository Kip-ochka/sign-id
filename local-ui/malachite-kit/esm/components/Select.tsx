import type { Ref, SelectHTMLAttributes } from 'react';
import './Select.css';
type SelectValue = {
    id: string | number;
    value: string | number | boolean;
    text?: string;
    subtext?: string;
};
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value' | 'onChange'> & {
    data: readonly SelectValue[];
    value?: SelectValue;
    onChange?: (option: SelectValue) => void;
    placeholder?: string;
    inputRef?: Ref<HTMLInputElement>;
};
export default function Select({
    data,
    placeholder = 'Выберите значение',
    inputRef,
    className = '',
    value,
    onChange,
    ...props
}: Props) {
    return (
        <select
            {...props}
            value={value ? String(value.id) : ''}
            onChange={(event) => {
                const option = data.find(({ id }) => String(id) === event.target.value);
                if (option) {
                    onChange?.(option);
                }
            }}
            ref={inputRef as unknown as Ref<HTMLSelectElement>}
            className={['digital_id_sign_kit_select', className].join(' ')}
        >
            <option value="">{placeholder}</option>
            {data.map(({ id, text, subtext }) => (
                <option key={id} value={String(id)}>
                    {[text, subtext].filter(Boolean).join(' · ')}
                </option>
            ))}
        </select>
    );
}
