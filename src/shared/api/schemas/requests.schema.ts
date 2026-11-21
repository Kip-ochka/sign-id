import { z } from 'zod';

import {
  certificateSchema,
  signingDocumentSchema,
  testDocumentSchema,
} from './common.schema';
import { isoDateTimeSchema } from './primitives.schema';
import type { Base64 } from './primitives.schema';

// Поля, общие для всех state/{event}.
export const stateBaseRequestSchema = z.object({
  inquiry_id: z.string(),
  req_time: isoDateTimeSchema,
  sc_name: z.literal('urn:front-corp-digital-id-microfront'),
  sp_name: z.literal('urn:corp-digital-id'),
});

export const startStateRequestSchema = stateBaseRequestSchema;
export const readyStateRequestSchema = stateBaseRequestSchema;

// certificate_base64 в JSON не входит — содержимое сертификата уходит файлом <serial_number>.b64.
export const requestCertificateSchema = certificateSchema.omit({
  certificate_base64: true,
});

// Подписи в JSON не входят — они уходят файлами в FormData (см. StateFiles).
export const checkStateRequestSchema = stateBaseRequestSchema.extend({
  test_document: testDocumentSchema,
  certificates: z.array(requestCertificateSchema).optional(),
});

export const signingStateRequestSchema = stateBaseRequestSchema.extend({
  documents: z.array(signingDocumentSchema),
  certificates: z.array(requestCertificateSchema).optional(),
});

const stateRequestSchemas = {
  start: startStateRequestSchema,
  ready: readyStateRequestSchema,
  check: checkStateRequestSchema,
  signing: signingStateRequestSchema,
};

type StateRequestSchemas = typeof stateRequestSchemas;
export type StateEvent = keyof StateRequestSchemas;

export type StateRequest = {
  [Event in StateEvent]: z.output<StateRequestSchemas[Event]>;
};

export type StartStateRequest = StateRequest['start'];
export type ReadyStateRequest = StateRequest['ready'];
export type CheckStateRequest = StateRequest['check'];
export type SigningStateRequest = StateRequest['signing'];

// Подпись в файле: fileName без расширения, .sig допишет files.ts.
export type SignatureFile = { fileName: string; base64: Base64 };

// Сертификат в файле: имя файла образуется из serialNumber.
export type CertificateFile = { serialNumber: string; base64: Base64 };

// Файлы, которые уходят в FormData помимо JSON-парта request.
export type StateFiles = {
  signatures: SignatureFile[];
  certificates: CertificateFile[];
};

export const getStateRequestSchema = <Event extends StateEvent>(
  event: Event,
): StateRequestSchemas[Event] => stateRequestSchemas[event];

export const documentRequestSchema = stateBaseRequestSchema.extend({
  document_id: z.string(),
});

// --- poll/status: тело то же, что у state/{event}, плюс идентификатор задачи.
export const pollStatusRequestSchema = stateBaseRequestSchema.extend({
  task: z.string(),
});
