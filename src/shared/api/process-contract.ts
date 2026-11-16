import { z } from 'zod';

import {
  isSupportedSigningMode,
  processResponseSchema,
} from './schemas/common.schema';
import {
  taskResponseSchema,
  unambiguousResponseSchema,
} from './schemas/responses.schema';
import type { SettingsResponse, StatusScreen } from './types';

export const localFallback = {
  process: 'STATUS',
  screen: {
    level: 'WARNING',
    title: 'Что-то пошло не так',
    message: 'Пожалуйста, попробуйте повторить попытку позже',
    buttons: {
      accent: { message: 'Попробовать снова', process: 'BACK' },
    },
  },
} satisfies StatusScreen;

const unsupportedSigningModeSchema = z.object({
  process: z.enum(['CHECK', 'SIGNING']),
  cryptopro: z
    .object({
      sign_type: z.string(),
      sign_format: z.string(),
      sign_position: z.string(),
    })
    .refine((mode) => !isSupportedSigningMode(mode)),
});

const processResultSchema = unambiguousResponseSchema.pipe(
  z.union([
    // Режим известен до валидации полей, нужных для отображения и подписи.
    unsupportedSigningModeSchema.transform((response) => ({
      kind: 'unsupported-mode' as const,
      mode: response.cryptopro,
      fallback: localFallback,
    })),
    taskResponseSchema.transform((response) => ({
      kind: 'task' as const,
      response,
    })),
    processResponseSchema.transform((response) => ({
      kind: 'process' as const,
      response,
    })),
  ]),
);

// Общая граница сценария для тела state и pollStatus после проверки HTTP-статуса.
export const parseProcessResult = (body: unknown) =>
  processResultSchema.safeParse(body);

export const getHttpAttemptLimit = ({ retry_count }: SettingsResponse) =>
  Math.max(1, retry_count);

export const getUnauthorizedAction = (
  hasRestartedAfterUnauthorized: boolean,
) => (hasRestartedAfterUnauthorized ? 'RESPONSE_ERROR' : 'START');
