import { z } from 'zod';

import { processResponseSchema } from './schemas/common.schema';
import { taskResponseSchema, unambiguousResponseSchema } from './schemas/responses.schema';
import type { SettingsResponse, StatusScreen } from './types';

export const localFallback = {
    process: 'STATUS',
    screen: {
        level: 'WARNING',
        title: 'Что-то пошло не так',
        message: 'Пожалуйста, попробуйте повторить попытку позже',
        buttons: {
            accent: { message: 'Попробовать снова', process: 'BACK' }
        }
    }
} satisfies StatusScreen;

const processResultSchema = unambiguousResponseSchema.pipe(
    z.union([
        taskResponseSchema.transform(response => ({
            kind: 'task' as const,
            response
        })),
        processResponseSchema.transform(response => ({
            kind: 'process' as const,
            response
        }))
    ])
);

// Общая граница сценария для тела state и pollStatus после проверки HTTP-статуса.
export const parseProcessResult = (body: unknown) => processResultSchema.safeParse(body);

export const getHttpAttemptLimit = ({ retry_count }: SettingsResponse) => Math.max(1, retry_count);
