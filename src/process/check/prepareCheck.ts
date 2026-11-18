import type { SignedEvent } from '../../entities/signing';
import type { CheckScreen } from '../../shared/api';
import {
  createCertificateFiles,
  createCheckSignature,
} from '../../shared/api/helpers/files';
import { requestCertificateSchema } from '../../shared/api/schemas/requests.schema';
import { signHash } from '../../shared/services/cryptoPro/adapter';

export async function prepareCheck(
  { screen: { test_document }, cryptopro }: CheckScreen,
  thumbprint: string,
  signal: AbortSignal,
): Promise<Extract<SignedEvent, { event: 'check' }>> {
  const { signatureBase64, certificate } = await signHash(
    {
      thumbprint,
      mode: cryptopro,
      filters: cryptopro.filters,
      hashes: test_document,
      parameters: { profile: 'PKCS7' },
    },
    signal,
  );
  return {
    event: 'check',
    payload: {
      test_document,
      certificates: [requestCertificateSchema.parse(certificate)],
    },
    files: {
      signatures: [createCheckSignature(signatureBase64)],
      certificates: createCertificateFiles([certificate]),
    },
  };
}
