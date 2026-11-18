import type { AxiosResponse } from 'axios';

import { createCertificateFile, createJSONPart, createSignatureFile } from './helpers/files';
import { parseDocumentResponse } from './helpers/parseDocumentResponse';
import { httpClient } from './http-client';
import type {
    DocumentData,
    DocumentRequestBody,
    PollStatusRequestBody,
    PollStatusResponse,
    ScreenKey,
    ScreenResponse,
    SettingKey,
    SettingsResponse,
    StateEvent,
    StateFiles,
    StateRequest,
    StateResponse,
} from './types';

const SETTINGS_URL = '/proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign/';
const DOCUMENT_URL = '/proxy/services/corp-digital-id-sign/api/public/v1/document';
const POLL_STATUS_URL = '/proxy/services/corp-digital-id-sign/api/public/v1/poll/status';
const STATE_URL = '/proxy/services/corp-digital-id-sign/api/public/v1/state';

// Перегрузки вместо generic: в SettingKey литерал 'settings' уже поглощён string,
// поэтому параметр типа ключа не сужает ответ до SettingsResponse.
export function getSettings(key: 'settings'): Promise<AxiosResponse<SettingsResponse>>;
export function getSettings(key: ScreenKey): Promise<AxiosResponse<ScreenResponse>>;
export function getSettings(key: SettingKey): Promise<AxiosResponse<SettingsResponse | ScreenResponse>> {
    return httpClient.get(SETTINGS_URL + key);
}

// Тело ответа — multipart/mixed, а не JSON: читаем байты как есть и разбираем вручную,
// иначе axios попытается распарсить multipart как JSON и потеряет части.
export const getDocument = async (body: DocumentRequestBody): Promise<DocumentData> => {
    const { data, headers } = await httpClient.post<ArrayBuffer>(DOCUMENT_URL, body, {
        responseType: 'arraybuffer',
    });

    return parseDocumentResponse(data, headers['content-type']);
};

export const pollStatus = (body: PollStatusRequestBody): Promise<AxiosResponse<PollStatusResponse>> =>
    httpClient.post(POLL_STATUS_URL, body);

// Порядок как в curl: request, затем signatures, затем certificates.
const toFormData = (request: unknown, { signatures, certificates }: StateFiles): FormData => {
    const formData = new FormData();

    formData.append('request', createJSONPart(request));
    signatures.map(createSignatureFile).forEach(file => formData.append('signatures', file));
    certificates.map(createCertificateFile).forEach(file => formData.append('certificates', file));

    return formData;
};

// check и signing уходят FormData: подписи и сертификаты — файлы, остальное — JSON-парт request.
type StateFilesByEvent = { [K in StateEvent]: K extends 'check' | 'signing' ? StateFiles : undefined };

// Тип файлов зависит от event, поэтому check/signing требуют files, start/ready — не принимают.
type StateArgs<E extends StateEvent> = StateFilesByEvent[E] extends StateFiles
    ? [event: E, body: StateRequest[E], files: StateFilesByEvent[E]]
    : [event: E, body: StateRequest[E]];

// Ответ не зависит от event: любой state/{event} может вернуть любой процесс или { task }.
// Коды 200/303 и поле process разбирает слой навигации, здесь response не читается.
// Тело типизируется по event; files обязательны для check/signing. Параметры распакованы из tuple
// как `[, ...rest]`: если типизировать body в самой сигнатуре, в объявлении появляется параметр,
// и подсказки в объекте тела пропадают — здесь event и files проверяет сигнатура.
export const state = async <E extends StateEvent>(
    ...[, ...rest]: StateArgs<E>
): Promise<AxiosResponse<StateResponse>> => {
    const [event, body, files] = rest as unknown as [E, StateRequest[E], StateFiles | undefined];

    if (event === 'start' || event === 'ready') {
        return httpClient.post(`${STATE_URL}/${event}`, body);
    }

    // Content-Type не задаём вручную — axios сам проставит boundary.
    return httpClient.post(`${STATE_URL}/${event}`, toFormData(body, files as StateFiles));
};
