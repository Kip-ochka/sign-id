import type { Base64, Certificate, CertificateFile, SignatureFile } from '../types';

const SIGNATURE_MIME = 'application/pkcs7-signature';

// Подпись — бинарник: base64 раскодируем в байты, иначе файл уйдёт текстом.
export const createSignatureFile = (signature: SignatureFile): File => {
    const binary = atob(signature.base64);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));

    return new File([bytes], `${signature.fileName}.sig`, { type: SIGNATURE_MIME });
};

// Сертификат — текст base64, передаём строкой, чтобы не перекодировать содержимое.
export const createCertificateFile = (certificate: CertificateFile): File =>
    new File([certificate.base64], `${certificate.serialNumber}.b64`, { type: 'text/plain' });

// Имя тестового файла подписи, как в контракте check.
export const createCheckSignature = (base64: Base64): SignatureFile => ({ fileName: 'test', base64 });

// Для signing имя подписи — document.id.
export const createSigningSignatures = (byDocumentId: Record<string, Base64>): SignatureFile[] =>
    Object.entries(byDocumentId).map(([documentId, base64]) => ({ fileName: documentId, base64 }));

// В файл уходит только содержимое сертификата, остальные поля — в JSON-парт request.
export const createCertificateFiles = (certificates: Certificate[]): CertificateFile[] =>
    certificates.map(({ serial_number, certificate_base64 }) => ({
        serialNumber: serial_number,
        base64: certificate_base64,
    }));

// JSON-парт: Blob с типом application/json даёт Content-Type парта,
// boundary в общий Content-Type проставит axios сам.
export const createJSONPart = (value: unknown): Blob => new Blob([JSON.stringify(value)], { type: 'application/json' });
