import type { Certificate as PluginCertificate } from 'crypto-pro-actual-cades-plugin';
import type { Certificate, CertificateFilters, TestDocument } from '../../api';
import { base64Schema, hash256Schema, hash512Schema } from '../../api';
import {
  matchCertificate,
  readCertificateNames,
  readCertificateNamesByOid,
} from './certificateNames';
import { CryptoProError, cryptoOperation } from './error';

type CertificateNames = ReturnType<typeof readCertificateNamesByOid>;
export type SigningCertificate = Omit<Certificate, 'certificate_base64'> & {
  pluginCertificate: PluginCertificate;
};
type SigningHashes = Partial<Pick<TestDocument, 'hash256' | 'hash512'>>;

function readBase64(value: unknown, stage: 'certificate' | 'signing') {
  // Плагин может переносить строки Base64.
  const base64 =
    typeof value === 'string' ? value.replace(/[\t \r\n]/g, '') : '';
  if (
    base64 &&
    base64.length % 4 === 0 &&
    base64Schema.safeParse(base64).success
  ) {
    try {
      if (btoa(atob(base64)) === base64) {
        return base64;
      }
    } catch (cause) {
      throw new CryptoProError(stage, 'BASE64_ERROR', cause);
    }
  }
  throw new CryptoProError(stage, 'BASE64_ERROR');
}

async function getValidCertificates() {
  const { getUserCertificates } = await import(
    /* webpackChunkName: "crypto-pro-actual-cades-plugin" */
    'crypto-pro-actual-cades-plugin'
  );
  let certificates: PluginCertificate[];
  try {
    certificates = await getUserCertificates(true);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Нет доступных сертификатов'
    ) {
      return [];
    }
    throw error;
  }
  const now = Date.now();
  return certificates.filter((certificate) => {
    if (!certificate.validFrom || !certificate.validTo) {
      return false;
    }
    const validFrom = new Date(certificate.validFrom).getTime();
    const validTo = new Date(certificate.validTo).getTime();
    return validFrom <= now && now <= validTo;
  });
}

async function readCertificate(
  certificate: PluginCertificate,
  { person, organization, issuer }: CertificateNames,
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
    person,
    organization,
    issuer,
    type: 'signed' as const,
    serial_number: serial,
    thumbprint: certificate.thumbprint,
    expires_at: expiry.toISOString(),
  };
}

async function readMatchingNames(
  certificate: PluginCertificate,
  filters?: CertificateFilters,
) {
  const { names, incomplete } = readCertificateNames(
    certificate.subjectName,
    certificate.issuerName,
  );
  const matched = matchCertificate(names, filters);
  if (matched && !incomplete) {
    return matched;
  }
  try {
    const decoded = readCertificateNamesByOid(await certificate.exportBase64());
    return matchCertificate(decoded, filters);
  } catch {
    // Отказ экспорта или разбора не мешает проверить другие сертификаты.
    return matched;
  }
}

export async function findCertificates(filters?: CertificateFilters) {
  return cryptoOperation(
    'certificate',
    'CERTIFICATE_SEARCH_FAILED',
    async () => {
      const certificates = new Map<string, SigningCertificate>();
      const candidates = await getValidCertificates();
      await candidates.reduce(async (previous, certificate) => {
        await previous;
        const thumbprint = certificate.thumbprint.toUpperCase();
        if (certificates.has(thumbprint)) {
          return;
        }
        const names = await readMatchingNames(certificate, filters);
        if (!names) {
          return;
        }
        try {
          certificates.set(thumbprint, {
            ...(await readCertificate(certificate, names)),
            pluginCertificate: certificate,
          });
        } catch {
          // Без реквизитов для запроса этот сертификат не предлагается.
        }
      }, Promise.resolve());
      if (!certificates.size) {
        throw new CryptoProError('certificate', 'NO_CERT');
      }
      return [...certificates.values()];
    },
  );
}

function selectHash(oid: string, hashes: SigningHashes) {
  // getAlgorithm читает OID открытого ключа, а не OID подписи издателя сертификата.
  let bits: 256 | 512;
  switch (oid) {
    case '1.2.643.7.1.1.1.1':
      bits = 256;
      break;
    case '1.2.643.7.1.1.1.2':
      bits = 512;
      break;
    default:
      throw new CryptoProError('signing', 'UNSUPPORTED_KEY_ALGORITHM');
  }
  const hash =
    bits === 256
      ? hash256Schema.safeParse(hashes.hash256)
      : hash512Schema.safeParse(hashes.hash512);
  if (!hash.success) {
    throw new CryptoProError('signing', 'INVALID_SIGNING_HASH');
  }
  return { bits, hex: hash.data };
}

export async function signHash(
  certificate: SigningCertificate,
  hashes: SigningHashes,
  signal?: AbortSignal,
) {
  const result = await signHashes(certificate, [hashes], signal);
  return {
    signatureBase64: result.signatures[0],
    certificate: result.certificate,
  };
}

export async function signHashes(
  { pluginCertificate, ...metadata }: SigningCertificate,
  documents: readonly SigningHashes[],
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const { oid } = await cryptoOperation(
    'certificate',
    'KEY_ALGORITHM_UNAVAILABLE',
    () => pluginCertificate.getAlgorithm(),
  );
  // Проверяем всю группу до первой подписи.
  const hashes = documents.map((document) => selectHash(oid, document));
  signal?.throwIfAborted();
  const publicCertificate = await cryptoOperation<Certificate>(
    'certificate',
    'CERTIFICATE_EXPORT_FAILED',
    async () => ({
      ...metadata,
      certificate_base64: readBase64(
        await pluginCertificate.exportBase64(),
        'certificate',
      ),
    }),
  );

  const signatures = await hashes.reduce<Promise<string[]>>(
    async (previous, hash) => {
      const result = await previous;
      signal?.throwIfAborted();
      result.push(await signSelectedHash(pluginCertificate, hash, signal));
      return result;
    },
    Promise.resolve([]),
  );
  signal?.throwIfAborted();
  return { signatures, certificate: publicCertificate };
}

async function signSelectedHash(
  certificate: PluginCertificate,
  hash: ReturnType<typeof selectHash>,
  signal?: AbortSignal,
) {
  const base64: unknown = await cryptoOperation(
    'plugin',
    'SIGNATURE_PREPARATION_FAILED',
    async () => {
      const { execute } = await import(
        /* webpackChunkName: "crypto-pro-actual-cades-plugin" */
        'crypto-pro-actual-cades-plugin'
      );
      return execute(async ({ cadesplugin }) => {
        const getLastError = (error: unknown): unknown =>
          cadesplugin.getLastError?.(error);
        const prepared = await cryptoOperation(
          'plugin',
          'SIGNATURE_PREPARATION_FAILED',
          async () => {
            const signingTime = await cadesplugin.CreateObjectAsync(
              'CADESCOM.CPAttribute',
            );
            const data = await cadesplugin.CreateObjectAsync(
              'CAdESCOM.HashedData',
            );
            const signedData = await cadesplugin.CreateObjectAsync(
              'CAdESCOM.CadesSignedData',
            );
            const signer =
              await cadesplugin.CreateObjectAsync('CAdESCOM.CPSigner');

            const now: Date & { getVarDate?: () => unknown } = new Date();
            await signingTime.propset_Name(
              cadesplugin.CADESCOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME,
            );
            await signingTime.propset_Value(
              now.getVarDate ? now.getVarDate() : now,
            );
            await signer.propset_Certificate(certificate._cadesCertificate);
            const attributes = await signer.AuthenticatedAttributes2;
            await attributes.Add(signingTime);
            await signer.propset_Options(
              cadesplugin.CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN,
            );

            await data.propset_Algorithm(
              hash.bits === 256
                ? cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256
                : cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_512,
            );
            await data.SetHashValue(hash.hex);
            return { data, signedData, signer };
          },
          getLastError,
        );
        signal?.throwIfAborted();
        return cryptoOperation(
          'signing',
          'SIGN_HASH_FAILED',
          async () =>
            prepared.signedData.SignHash(
              prepared.data,
              prepared.signer,
              cadesplugin.CADESCOM_PKCS7_TYPE,
            ),
          getLastError,
        );
      });
    },
  );
  return readBase64(base64, 'signing');
}
