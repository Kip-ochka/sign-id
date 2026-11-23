import { z } from 'zod';

import { hash256Schema, hash512Schema, isoDateTimeSchema, nonNegativeIntSchema } from './primitives.schema';

// --- Кнопки экранов: url и process взаимоисключающие, на сервере задано ровно одно из полей.
export const screenButtonActionSchema = z.union([
    z.object({
        message: z.string(),
        url: z.string(),
        process: z.string().optional()
    }),
    z.object({
        message: z.string(),
        process: z.string(),
        url: z.string().optional()
    })
]);

export const screenButtonsSchema = z.object({
    accent: screenButtonActionSchema,
    secondary: screenButtonActionSchema.optional()
});

// --- Сертификат: данные достаются из самого сертификата, type всегда хардкодим.
// Та же структура используется и в фильтрах поиска сертификатов, и в запросах.
export const personSchema = z.object({
    last_name: z.string(),
    first_name: z.string(),
    middle_name: z.string(),
    inn: z.string(),
    snils: z.string()
});

export const organizationSchema = z.object({
    name: z.string(),
    inn: z.string(),
    ogrn: z.string()
});

export const issuerSchema = z.object({
    name: z.string(),
    inn: z.string(),
    ogrn: z.string()
});

export const certificateSchema = z.object({
    type: z.literal('signed'),
    serial_number: z.string(),
    thumbprint: z.string(),
    expires_at: isoDateTimeSchema.optional(),
    certificate_base64: z.string(), // содержимое <serial_number>.b64, без PEM-заголовков
    person: personSchema.partial().optional(),
    organization: organizationSchema.partial().optional(),
    issuer: issuerSchema.partial().optional()
});

// --- cryptopro: фильтры поиска — любое поле и любой вложенный объект может отсутствовать,
// каждое переданное поле содержит одну строку.
export const certificateFiltersSchema = z.object({
    person: personSchema.partial().optional(),
    organization: organizationSchema.partial().optional(),
    issuer: issuerSchema.partial().optional()
});

export const cryptoproSchema = z.object({
    tsp_address: z.string(),
    // Пока CHECK и SIGNING используют одну отсоединённую подпись при любом режиме.
    sign_type: z.string(),
    sign_format: z.string(),
    sign_position: z.string(),
    hash256_archived: hash256Schema.optional(),
    hash512_archived: hash512Schema.optional(),
    filters: certificateFiltersSchema.optional()
});

const cryptoproSigningSchema = cryptoproSchema.extend({
    tsp_address: z.string().trim().min(1)
});

// В ответе SETTING приходят только фильтры, без остальных параметров подписи.
export const cryptoproFiltersOnlySchema = z.object({
    filters: certificateFiltersSchema.optional()
});

export const testDocumentSchema = z.object({
    format: z.string(),
    hash256: hash256Schema,
    hash512: hash512Schema
});

export const consentSchema = z.object({
    text: z.string(),
    hypertext: z.string(),
    url: z.string()
});

// --- SETTING
export const settingItemStateSchema = z.enum(['WAIT', 'SUCCESS', 'ERROR']);

export const settingListSchema = z.object({
    name: z.string(),
    state: settingItemStateSchema,
    message: z.string(),
    description: z.string(),
    text_button: z.string()
});

export const settingScreenSchema = z.object({
    process: z.literal('SETTING'),
    session: z.string(),
    screen: z.object({
        title: z.string(),
        message: z.string(),
        lists: z.object({ testing: z.array(settingListSchema).optional() }).optional(),
        buttons: screenButtonsSchema
    }),
    cryptopro: cryptoproFiltersOnlySchema.optional()
});

// --- CHECK
export const checkScreenSchema = z.object({
    process: z.literal('CHECK'),
    screen: z.object({
        title: z.string(),
        message: z.string(),
        consent: consentSchema,
        test_document: testDocumentSchema,
        buttons: screenButtonsSchema
    }),
    cryptopro: cryptoproSigningSchema
});

// --- SIGNING
export const signingDocumentSchema = z.object({
    id: z.string(),
    format: z.string(),
    title: z.string(),
    hash256: hash256Schema,
    hash512: hash512Schema
});

export const signingScreenSchema = z.object({
    process: z.literal('SIGNING'),
    token: z.string(),
    screen: z.object({
        title: z.string(),
        message: z.string(),
        step: z.string().optional(),
        lists: z.object({
            documents: z
                .array(signingDocumentSchema)
                .nonempty()
                .refine(documents => {
                    const ids = documents.map(({ id }) => id);
                    return ids.every(id => id.trim().length > 0) && new Set(ids).size === ids.length;
                }, 'Документам нужны уникальные непустые id')
        }),
        buttons: screenButtonsSchema
    }),
    cryptopro: cryptoproSigningSchema
});

// --- STATUS: ERROR сейчас не используется, но может прийти.
export const statusLevelSchema = z.enum(['SUCCESS', 'WARNING', 'ERROR']);

export const statusScreenSchema = z.object({
    process: z.literal('STATUS'),
    timer: nonNegativeIntSchema.optional(),
    screen: z.object({
        level: statusLevelSchema,
        title: z.string(),
        message: z.string(),
        buttons: screenButtonsSchema
    })
});

// Ответ state/{event} и poll/status, который пришёл с процессом: дискриминант — process.
export const processResponseSchema = z.discriminatedUnion('process', [
    settingScreenSchema,
    checkScreenSchema,
    signingScreenSchema,
    statusScreenSchema
]);

export type ScreenButtonAction = z.infer<typeof screenButtonActionSchema>;
export type ScreenButtons = z.infer<typeof screenButtonsSchema>;
export type Person = z.infer<typeof personSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Issuer = z.infer<typeof issuerSchema>;
export type Certificate = z.infer<typeof certificateSchema>;
export type CertificateFilters = z.infer<typeof certificateFiltersSchema>;
export type Cryptopro = z.infer<typeof cryptoproSchema>;
export type CryptoproFiltersOnly = z.infer<typeof cryptoproFiltersOnlySchema>;
export type TestDocument = z.infer<typeof testDocumentSchema>;
export type Consent = z.infer<typeof consentSchema>;
export type SettingItemState = z.infer<typeof settingItemStateSchema>;
export type SettingList = z.infer<typeof settingListSchema>;
export type SettingScreen = z.infer<typeof settingScreenSchema>;
export type CheckScreen = z.infer<typeof checkScreenSchema>;
export type SigningDocument = z.infer<typeof signingDocumentSchema>;
export type SigningScreen = z.infer<typeof signingScreenSchema>;
export type StatusLevel = z.infer<typeof statusLevelSchema>;
export type StatusScreen = z.infer<typeof statusScreenSchema>;
export type ProcessResponse = z.infer<typeof processResponseSchema>;
