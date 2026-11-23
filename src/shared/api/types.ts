// Все типы контракта выводятся из zod-схем — см. schemas/.
import type { z } from 'zod';

import type { documentRequestSchema, pollStatusRequestSchema } from './schemas';

export type {
    Base64,
    Certificate,
    CertificateFile,
    CertificateFilters,
    CheckScreen,
    CheckStateRequest,
    Consent,
    Cryptopro,
    CryptoproFiltersOnly,
    DocumentData,
    DocumentResponse,
    Hash256,
    Hash512,
    IsoDateTime,
    Issuer,
    NonNegativeInt,
    Organization,
    Person,
    PollStatusResponse,
    ProcessResponse,
    ReadyStateRequest,
    Screen,
    ScreenButtonAction,
    ScreenButtons,
    ScreenKey,
    ScreenResponse,
    SettingItemState,
    SettingKey,
    SettingList,
    SettingScreen,
    SettingsResponse,
    SignatureFile,
    SigningDocument,
    SigningScreen,
    SigningStateRequest,
    StartStateRequest,
    StateEvent,
    StateFiles,
    StateRequest,
    StateResponse,
    StatusLevel,
    StatusScreen,
    TaskResponse,
    TestDocument
} from './schemas';

export type DocumentRequestBody = z.infer<typeof documentRequestSchema>;
export type PollStatusRequestBody = z.infer<typeof pollStatusRequestSchema>;
