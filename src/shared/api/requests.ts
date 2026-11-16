import type { AxiosResponse } from 'axios';

import { createStateFormData } from './helpers/files';
import { parseDocumentResponse } from './helpers/parseDocumentResponse';
import { httpClient } from './http-client';
import type {
  DocumentData,
  DocumentRequestBody,
  PollStatusRequestBody,
  ScreenKey,
  ScreenResponse,
  SettingKey,
  SettingsResponse,
  StateEvent,
  StateFiles,
  StateRequest,
} from './types';

const SETTINGS_URL =
  '/proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign/';
const SIGNING_API_URL = '/proxy/services/corp-digital-id-sign/api/public/v1';

// Перегрузка для string предполагает ключ экрана. Динамический string может содержать 'settings'.
export function getSettings(
  key: 'settings',
  signal?: AbortSignal,
): Promise<AxiosResponse<SettingsResponse>>;
export function getSettings(
  key: ScreenKey,
  signal?: AbortSignal,
): Promise<AxiosResponse<ScreenResponse>>;
export function getSettings(
  key: SettingKey,
  signal?: AbortSignal,
): Promise<AxiosResponse<SettingsResponse | ScreenResponse>> {
  return httpClient.get<SettingsResponse | ScreenResponse>(SETTINGS_URL + key, {
    signal,
  });
}

export const getDocument = async (
  body: DocumentRequestBody,
  signal?: AbortSignal,
): Promise<DocumentData> => {
  const { data, headers } = await httpClient.post<ArrayBuffer>(
    `${SIGNING_API_URL}/document`,
    body,
    {
      responseType: 'arraybuffer',
      signal,
      validateStatus: (status) => status === 200,
    },
  );

  return parseDocumentResponse(data, headers['content-type']);
};

export const pollStatus = (
  body: PollStatusRequestBody,
  signal?: AbortSignal,
): Promise<AxiosResponse<unknown>> =>
  httpClient.post<unknown>(`${SIGNING_API_URL}/poll/status`, body, { signal });

type StateArgs = {
  [Event in StateEvent]: Event extends 'check' | 'signing'
    ? [
        event: Event,
        body: StateRequest[Event],
        files: StateFiles,
        signal?: AbortSignal,
      ]
    : [event: Event, body: StateRequest[Event], signal?: AbortSignal];
}[StateEvent];

export const state = async (
  ...[event, body, filesOrSignal, signal]: StateArgs
): Promise<AxiosResponse<unknown>> => {
  const signed = event === 'check' || event === 'signing';
  const payload = signed
    ? createStateFormData(event, body, filesOrSignal)
    : body;

  return httpClient.post<unknown>(
    `${SIGNING_API_URL}/state/${event}`,
    payload,
    {
      signal: signed ? signal : filesOrSignal,
      validateStatus: (status) =>
        status === 303 || (status >= 200 && status < 300),
    },
  );
};
