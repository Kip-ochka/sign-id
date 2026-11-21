import Select from '@sber-site/malachite-kit/esm/components/Select';
import { useRef, useState } from 'react';
import { toCertificateSelectValue } from './certificateList';
import type {
  CertificateList,
  CertificateOption,
  CertificateSelectValue,
} from './certificateList';

export function CertificatePicker({
  certificates,
  selected,
  onSelect,
  busy,
  className,
}: {
  certificates: CertificateList;
  selected?: CertificateOption;
  onSelect: (id: string) => void;
  busy: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  if (certificates.status === 'loading' || certificates.options.length < 2) {
    return null;
  }
  const data = certificates.options.map(toCertificateSelectValue);
  return (
    <Select
      className={className}
      autoFocus={false}
      name="certificate"
      required={false}
      inputRef={ref}
      autoComplete="none"
      aria-label="Выберите сертификат"
      value={data.find(({ id }) => id === selected?.id)}
      disabled={busy}
      onChange={({ value }: CertificateSelectValue) => {
        if (typeof value === 'string') {
          onSelect(value);
        }
      }}
      placeholder="Выберите сертификат"
      data={data}
    />
  );
}
export function useSelectedCertificate(certificates: CertificateList) {
  const [selectedId, selectCertificate] = useState('');
  const options = certificates.status === 'loaded' ? certificates.options : [];
  const selected =
    options.length === 1
      ? options[0]
      : options.find(({ id }) => id === selectedId);
  return { selected, selectCertificate };
}
export type SignatureControls = {
  certificates: CertificateList;
  busy: boolean;
  onSign?: (certificate: CertificateOption) => void;
};
