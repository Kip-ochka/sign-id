import type { Certificate as PluginCertificate } from 'crypto-pro-actual-cades-plugin';
import type { CertificateFilters, Cryptopro, TestDocument } from '../../api';
import { isSupportedSigningMode } from '../../api/schemas/common.schema';
import {
  base64Schema,
  hash256Schema,
  hash512Schema,
} from '../../api';
import { matchesCertificate, readCertificateNames } from './certificateNames';
import { CryptoProError, cryptoOperation } from './error';

type CertificateNames = ReturnType<typeof readCertificateNames>;
type SigningMode = Pick<
  Cryptopro,
  'sign_type' | 'sign_format' | 'sign_position'
>;

export type HashSignatureParameters =
  | { profile: 'PKCS7'; tsaAddress?: never }
  | { profile: 'CADES_T' | 'CADES_X_LONG_TYPE_1'; tsaAddress: string };

function readBase64(value: unknown, stage: 'certificate' | 'signing') {
  // Плагин переносит строки Base64. Прочие символы и повреждённый padding означают ошибку.
  const base64 =
    typeof value === 'string' ? value.replace(/[\t \r\n]/g, '') : '';
  if (
    !base64 ||
    base64.length % 4 !== 0 ||
    !base64Schema.safeParse(base64).success
  ) {
    throw new CryptoProError(stage, 'BASE64_ERROR');
  }
  try {
    if (btoa(atob(base64)) === base64) return base64;
  } catch (cause) {
    throw new CryptoProError(stage, 'BASE64_ERROR', cause);
  }
  throw new CryptoProError(stage, 'BASE64_ERROR');
}

async function* matchingCertificates(filters?: CertificateFilters) {
  const { getUserCertificates } =
    await import('crypto-pro-actual-cades-plugin');
  let certificates: PluginCertificate[];
  try {
    certificates = await getUserCertificates(true);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Нет доступных сертификатов'
    ) {
      return;
    }
    throw error;
  }
  for (const certificate of certificates) {
    const names = readCertificateNames(
      certificate.subjectName,
      certificate.issuerName,
    );
    if (matchesCertificate(names, filters)) yield { certificate, names };
  }
}

async function readCertificate(
  certificate: PluginCertificate,
  names: CertificateNames,
) {
  const serial = await certificate.getCadesProp('SerialNumber');
  const expiry = new Date(certificate.validTo);
  if (
    typeof serial !== 'string' ||
    !serial.trim() ||
    !certificate.thumbprint.trim() ||
    !Number.isFinite(expiry.getTime())
  ) {
    throw new CryptoProError('certificate', 'CERTIFICATE_DATA_INVALID');
  }
  return {
    ...names,
    type: 'signed' as const,
    serial_number: serial,
    thumbprint: certificate.thumbprint,
    expires_at: expiry.toISOString(),
  };
}

export type SigningCertificate = Awaited<ReturnType<typeof readCertificate>>;

export async function findCertificates(filters?: CertificateFilters) {
  return cryptoOperation(
    'certificate',
    'CERTIFICATE_SEARCH_FAILED',
    async () => {
      const certificates = new Map<string, SigningCertificate>();
      for await (const { certificate, names } of matchingCertificates(
        filters,
      )) {
        const thumbprint = certificate.thumbprint.toUpperCase();
        if (!certificates.has(thumbprint)) {
          certificates.set(
            thumbprint,
            await readCertificate(certificate, names),
          );
        }
      }
      if (!certificates.size)
        throw new CryptoProError('certificate', 'NO_CERT');
      return [...certificates.values()];
    },
  );
}

function selectHash(
  oid: string,
  hashes: Partial<Pick<TestDocument, 'hash256' | 'hash512'>>,
) {
  // getAlgorithm читает OID открытого ключа, а не OID подписи издателя сертификата.
  const bits =
    oid === '1.2.643.7.1.1.1.1'
      ? 256
      : oid === '1.2.643.7.1.1.1.2'
        ? 512
        : undefined;
  if (!bits) throw new CryptoProError('signing', 'UNSUPPORTED_KEY_ALGORITHM');
  const hash =
    bits === 256
      ? hash256Schema.safeParse(hashes.hash256)
      : hash512Schema.safeParse(hashes.hash512);
  if (!hash.success)
    throw new CryptoProError('signing', 'INVALID_SIGNING_HASH');
  return { bits, hex: hash.data };
}

export async function signHash({
  thumbprint,
  mode,
  filters,
  hashes,
  parameters,
}: {
  thumbprint: string;
  mode: SigningMode;
  filters?: CertificateFilters;
  hashes: Partial<Pick<TestDocument, 'hash256' | 'hash512'>>;
  parameters: HashSignatureParameters;
}) {
  if (!isSupportedSigningMode(mode)) {
    throw new CryptoProError('signing', 'UNSUPPORTED_SIGNING_MODE');
  }
  if (
    parameters.profile !== 'PKCS7' &&
    !(
      (parameters.profile === 'CADES_T' ||
        parameters.profile === 'CADES_X_LONG_TYPE_1') &&
      parameters.tsaAddress?.trim()
    )
  ) {
    throw new CryptoProError('signing', 'SIGNATURE_PARAMETERS_REQUIRED');
  }

  const selected = await cryptoOperation(
    'certificate',
    'CERTIFICATE_SEARCH_FAILED',
    async () => {
      for await (const item of matchingCertificates(filters)) {
        if (
          item.certificate.thumbprint.toUpperCase() === thumbprint.toUpperCase()
        )
          return item;
      }
      throw new CryptoProError('certificate', 'NO_CERT');
    },
  );

  const { certificate, names } = selected;
  const { oid } = await cryptoOperation(
    'signing',
    'KEY_ALGORITHM_UNAVAILABLE',
    () => certificate.getAlgorithm(),
  );
  const hash = selectHash(oid, hashes);
  const publicCertificate = await cryptoOperation(
    'certificate',
    'CERTIFICATE_EXPORT_FAILED',
    async () => ({
      ...(await readCertificate(certificate, names)),
      certificate_base64: readBase64(
        await certificate.exportBase64(),
        'certificate',
      ),
    }),
  );

  const signatureBase64 = await cryptoOperation(
    'signing',
    'SIGN_HASH_FAILED',
    async () => {
      const { execute } = await import('crypto-pro-actual-cades-plugin');
      const base64: unknown = await execute(async ({ cadesplugin }) => {
        const data = await cadesplugin.CreateObjectAsync('CAdESCOM.HashedData');
        await data.propset_Algorithm(
          hash.bits === 256
            ? cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256
            : cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_512,
        );
        await data.SetHashValue(hash.hex);

        const signer = await cadesplugin.CreateObjectAsync('CAdESCOM.CPSigner');
        // Тот же сертификат, который прошёл актуальный фильтр и был экспортирован.
        await signer.propset_Certificate(certificate._cadesCertificate);
        const profile = {
          PKCS7: cadesplugin.CADESCOM_PKCS7_TYPE,
          CADES_T: cadesplugin.CADESCOM_CADES_T,
          CADES_X_LONG_TYPE_1: cadesplugin.CADESCOM_CADES_X_LONG_TYPE_1,
        }[parameters.profile];
        if (parameters.profile !== 'PKCS7') {
          await signer.propset_TSAAddress(parameters.tsaAddress);
        }
        const signedData = await cadesplugin.CreateObjectAsync(
          'CAdESCOM.CadesSignedData',
        );
        return signedData.SignHash(data, signer, profile);
      });
      return readBase64(base64, 'signing');
    },
  );
  return { signatureBase64, certificate: publicCertificate };
}
