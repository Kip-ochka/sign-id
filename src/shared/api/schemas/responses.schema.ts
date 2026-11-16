import { z } from 'zod';

import { processResponseSchema } from './common.schema';
import { base64Schema } from './primitives.schema';

export const taskResponseSchema = z.object({
  task: z.string().refine((task) => task.trim().length > 0),
});

// Ответ не зависит от event: любой state/{event} может вернуть любой процесс или task.
export const unambiguousResponseSchema = z
  .looseObject({})
  .refine((body) => !('task' in body && 'process' in body));

export const stateResponseSchema = unambiguousResponseSchema.pipe(
  z.union([taskResponseSchema, processResponseSchema]),
);
export const pollStatusResponseSchema = stateResponseSchema;

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
