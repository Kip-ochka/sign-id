import { z } from 'zod';

import { screenButtonsSchema } from './common.schema';
import { nonNegativeIntSchema } from './primitives.schema';

// --- settings: /proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign/settings
export const settingKeySchema = z.string();

export const settingsResponseSchema = z.object({
    retry_time: nonNegativeIntSchema,
    retry_addition: nonNegativeIntSchema,
    retry_count: nonNegativeIntSchema,
    pull_time: nonNegativeIntSchema
});

// --- settings/{key} для ключа-кода ошибки
// Рендерится только предупреждениями, поэтому level здесь — литерал 'WARNING'.
export const screenSchema = z.object({
    level: z.literal('WARNING'),
    title: z.string(),
    message: z.string(),
    buttons: screenButtonsSchema
});

export const screenResponseSchema = z.object({
    process: z.string(), // По умолчанию 'STATUS'
    screen: screenSchema
});

export type SettingKey = z.infer<typeof settingKeySchema>;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type ScreenResponse = z.infer<typeof screenResponseSchema>;

// Ключ экрана — всё, кроме 'settings'. Сводится к string, пока коды ошибок не вынесены в литералы.
export type ScreenKey = Exclude<SettingKey, 'settings'>;
