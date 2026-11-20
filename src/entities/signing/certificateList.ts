import type { SigningCertificate } from '../../shared/services/cryptoPro/adapter';

export type CertificateOption = {
  id: string;
  title: string;
  organization: string;
  serial: string;
  expires?: string;
};

export type CertificateList =
  | { status: 'loading' }
  | { status: 'loaded'; options: readonly CertificateOption[] };

export function toCertificateList(
  certificates?: readonly SigningCertificate[],
): CertificateList {
  if (!certificates) {
    return { status: 'loading' };
  }
  return {
    status: 'loaded',
    options: certificates.map((certificate) => ({
      id: certificate.thumbprint,
      title:
        [
          certificate.person?.last_name,
          certificate.person?.first_name,
          certificate.person?.middle_name,
        ]
          .filter(Boolean)
          .join(' ') || certificate.serial_number,
      organization: certificate.organization?.name ?? '',
      serial: certificate.serial_number,
      expires: certificate.expires_at
        ? new Date(certificate.expires_at).toLocaleDateString('ru-RU')
        : '',
    })),
  };
}

export function toCertificateSelectData(options: readonly CertificateOption[]) {
  return options.map(({ id, title, organization, serial, expires }) => {
    const duplicate = options.some(
      (other) =>
        other.id !== id &&
        other.title === title &&
        other.organization === organization,
    );
    return {
      id,
      value: id,
      title,
      description: organization,
      serial,
      expires,
      text: [title, organization, duplicate && serial]
        .filter(Boolean)
        .join(' · '),
    };
  });
}
