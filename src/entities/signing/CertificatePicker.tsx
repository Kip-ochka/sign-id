import Select from '@sber-site/malachite-kit/esm/components/Select';
import { useState } from 'react';
import { Loading } from '../../shared/ui/Loading';
import styles from '../../shared/ui/Screen.module.css';
export type CertificateOption = {
  id: string;
  title: string;
  organization: string;
  serial: string;
  expires?: string;
};

export type CertificateList =
  | { status: 'unavailable' | 'loading' }
  | { status: 'loaded'; options: readonly CertificateOption[] };

export function CertificatePicker({
  certificates,
  selected,
  onSelect,
  busy,
}: {
  certificates: CertificateList;
  selected?: CertificateOption;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  return (
    <section className={styles.section} aria-labelledby="certificate-title">
      <h2 id="certificate-title">Сертификат</h2>
      {certificates.status === 'unavailable' && (
        <p className={styles.detail}>
          Подключение сертификатов пока недоступно.
        </p>
      )}
      {certificates.status === 'loading' && <Loading>Ищем сертификаты</Loading>}
      {certificates.status === 'loaded' && (
        <>
          {certificates.options.length === 0 && (
            <p role="alert">Подходящие сертификаты не найдены.</p>
          )}
          {certificates.options.length > 0 && (
            <label className={styles.field}>
              <span>Выберите сертификат</span>
              <Select
                aria-label="Выберите сертификат"
                value={selected?.id ?? ''}
                disabled={busy}
                onChange={(event) => onSelect(event.target.value)}
                placeholder="Выберите сертификат"
                data={certificates.options.map(
                  ({ id, title, organization, serial }) => ({
                    id,
                    value: id,
                    text: [title, organization, serial]
                      .filter(Boolean)
                      .join(' · '),
                  }),
                )}
              />
            </label>
          )}
          {selected && (
            <div className={styles.certificate}>
              <strong>{selected.title}</strong>
              {selected.organization && (
                <div className={styles.detail}>{selected.organization}</div>
              )}
              {selected.expires && (
                <div className={styles.detail}>
                  Действует до {selected.expires}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
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
