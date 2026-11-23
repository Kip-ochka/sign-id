import type { SignedEvent } from '../../entities/signing';
import type { CheckScreen } from '../../shared/api';
import { createCertificateFiles, createCheckSignature } from '../../shared/api/helpers/files';
import { requestCertificateSchema } from '../../shared/api/schemas/requests.schema';
import { signHash, type SigningCertificate } from '../../shared/services/cryptoPro/adapter';

export async function prepareCheck(
    { screen: { test_document } }: CheckScreen,
    selectedCertificate: SigningCertificate,
    signal: AbortSignal
): Promise<Extract<SignedEvent, { event: 'check' }>> {
    const { signatureBase64, certificate } = await signHash(selectedCertificate, test_document, signal);
    return {
        event: 'check',
        payload: {
            test_document,
            certificates: [requestCertificateSchema.parse(certificate)]
        },
        files: {
            signatures: [createCheckSignature(signatureBase64)],
            certificates: createCertificateFiles([certificate])
        }
    };
}
