import Select from '@sber-site/malachite-kit/esm/components/Select';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useRef, useState } from 'react';
export type CertificateOption = {
  id: string;
  title: string;
  organization: string;
  serial: string;
  expires?: string;
};
export type CertificateList =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'loaded'; options: readonly CertificateOption[] };
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
  if (certificates.status === 'unavailable') {
    return <Text>Подключение сертификатов пока недоступно.</Text>;
  }
  if (certificates.status === 'loading') {
    return <Text role="status">Ищем сертификаты</Text>;
  }
  if (certificates.options.length === 0) {
    return <Text role="alert">Подходящие сертификаты не найдены.</Text>;
  }
  return (
    <Select
      className={className}
      autoFocus={false}
      name="certificate"
      required={false}
      inputRef={ref}
      autoComplete="none"
      aria-label="Выберите сертификат"
      value={selected?.id ?? ''}
      disabled={busy}
      onChange={(event: { target: { value: string } }) =>
        onSelect(event.target.value)
      }
      placeholder="Выберите сертификат"
      data={certificates.options.map(({ id, title, organization, serial }) => ({
        id,
        value: id,
        text: [title, organization, serial].filter(Boolean).join(' · '),
      }))}
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
