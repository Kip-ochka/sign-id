import { z } from 'zod';

// Карта «ключ → схема»: конкретные схемы (ZodObject после .extend) сохраняются как есть.
export type SchemaByKey<S extends { [K in keyof S]: z.ZodType }> = S;

// Тип тела по ключу. `S[K]['_zod']['output']` (а не infer по z.ZodType) оставляет схему
// конкретной, поэтому .extend и проверка значений продолжают работать.
export type OutputByKey<S extends { [K in keyof S]: z.ZodType }> = { [K in keyof S]: S[K]['_zod']['output'] };
