import { z } from 'zod';

import { certificateSchema, signingDocumentSchema, testDocumentSchema } from './common.schema';
import { isoDateTimeSchema } from './primitives.schema';
import type { Base64 } from './primitives.schema';
import type { OutputByKey } from './schema-by-key';

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
// Сама certificateSchema остаётся полной: её использует навигация (ответы cryptopro).
export const requestCertificateSchema = certificateSchema.omit({ certificate_base64: true });

// Подписи в JSON не входят — они уходят файлами в FormData (см. StateFiles).
export const checkStateRequestSchema = stateBaseRequestSchema.extend({
    test_document: testDocumentSchema,
    certificates: z.array(requestCertificateSchema),
});

export const signingStateRequestSchema = stateBaseRequestSchema.extend({
    documents: z.array(signingDocumentSchema),
    certificates: z.array(requestCertificateSchema),
});

// Единственный источник правды для state/{event}: из него выводятся StateEvent, StateRequest
// и рантайм-вход getStateRequestSchema. Новый event — одна строка здесь (+ файлы в StateFiles).
const stateRequestShape = {
    start: startStateRequestSchema,
    ready: readyStateRequestSchema,
    check: checkStateRequestSchema,
    signing: signingStateRequestSchema,
};

export type StateEvent = keyof typeof stateRequestShape;

export type StateRequest = OutputByKey<typeof stateRequestShape>;

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

// Проверка соответствия карты схем и StateRequest: новое/переименованное событие или разошедшаяся
// схема дают mismatch. Различие с сервером должны ловить тесты, а не runtime-типизация запроса.
type StateRequestSchemaMismatch<K extends StateEvent> = z.output<(typeof stateRequestShape)[K]> extends StateRequest[K]
    ? StateRequest[K] extends z.output<(typeof stateRequestShape)[K]>
        ? never
        : K
    : K;

// Валидация тела по событию. Схема карты индексируется по generic-ключу и сужается до union'а,
// поэтому тип схемы берётся из StateRequest[K], а соответствие проверяет StateRequestSchemaMismatch.
export const getStateRequestSchema: <K extends StateEvent>(
    event: K
) => z.ZodType<StateRequest[K] & StateRequestSchemaMismatch<K>> = event => {
    const schema = stateRequestShape[event];

    return schema as typeof schema & z.ZodType<StateRequest[typeof event] & StateRequestSchemaMismatch<typeof event>>;
};

// --- document: тело запроса описано в PLAN.md, ответ — в responses.schema.ts
export const documentRequestSchema = stateBaseRequestSchema.extend({
    document_id: z.string(),
});

// --- poll/status: тело то же, что у state/{event}, плюс идентификатор задачи.
export const pollStatusRequestSchema = stateBaseRequestSchema.extend({
    task: z.string(),
});
