import type { SignedEvent } from '../../entities/signing';
import type { SigningScreen } from '../../shared/api';
import { createCertificateFiles } from '../../shared/api/helpers/files';
import { requestCertificateSchema } from '../../shared/api/schemas/requests.schema';
import { signHashes } from '../../shared/services/cryptoPro/adapter';
import type { SigningCertificate } from '../../shared/services/cryptoPro/adapter';

export async function prepareSigning(
    { screen: { lists } }: SigningScreen,
    selectedCertificate: SigningCertificate,
    signal: AbortSignal,
): Promise<Extract<SignedEvent, { event: 'signing' }>> {
    const documents = lists.documents.map((document) => ({ ...document }));
    const { signatures, certificate } = await signHashes(selectedCertificate, documents, signal);

    return {
        event: 'signing',
        payload: {
            documents,
            certificates: [requestCertificateSchema.parse(certificate)],
        },
        files: {
            signatures: documents.map(({ id }, index) => ({
                fileName: id,
                base64: signatures[index],
            })),
            certificates: createCertificateFiles([certificate]),
        },
    };
}
