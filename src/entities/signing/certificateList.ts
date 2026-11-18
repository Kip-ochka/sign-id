import type { SigningCertificate } from '../../shared/services/cryptoPro/adapter';
import type { CertificateList } from './CertificatePicker';

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
