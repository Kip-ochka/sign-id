import { z } from 'zod';

import { processResponseSchema } from './common.schema';
import { base64Schema } from './primitives.schema';

// 303 на state/{event} и «ещё не готово» на poll/status: только id таски, без process.
export const taskResponseSchema = z.object({
    task: z.string(),
});

// Ответ не зависит от event: любой state/{event} может вернуть любой процесс или task.
export const stateResponseSchema = z.union([taskResponseSchema, processResponseSchema]);
export const pollStatusResponseSchema = z.union([taskResponseSchema, processResponseSchema]);

// JSON-часть `response` в multipart/mixed: только метаданные документа.
export const documentResponseSchema = z.object({
    document_id: z.string(),
    title: z.string(),
    format: z.string(),
});

// Результат parseDocumentResponse, а не тело HTTP-ответа (тело — multipart/mixed):
// метаданные из части response плюс base64 содержимого из части file.
export const documentDataSchema = documentResponseSchema.extend({
    base64: base64Schema,
});

export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type StateResponse = z.infer<typeof stateResponseSchema>;
export type PollStatusResponse = z.infer<typeof pollStatusResponseSchema>;
export type DocumentResponse = z.infer<typeof documentResponseSchema>;
export type DocumentData = z.infer<typeof documentDataSchema>;
