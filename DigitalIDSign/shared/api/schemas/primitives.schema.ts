import { z } from 'zod';

// Неотрицательные целые: отрицательные задержки/счётчики ломают ретраи и пуллинг.
export const nonNegativeIntSchema = z.number().int().nonnegative();

export const hash256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
export const hash512Schema = z.string().regex(/^[a-f0-9]{128}$/i);

// Пустая строка допустима: подпись может отсутствовать у части документов.
export const base64Schema = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);

// Смещение обязательно: в контракте встречаются и 'Z', и '+03:00'.
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export type NonNegativeInt = z.infer<typeof nonNegativeIntSchema>;
export type Hash256 = z.infer<typeof hash256Schema>;
export type Hash512 = z.infer<typeof hash512Schema>;
export type Base64 = z.infer<typeof base64Schema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
