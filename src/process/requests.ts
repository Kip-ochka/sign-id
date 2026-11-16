import { isAxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

import {
  getDocument,
  getSettings,
  localFallback,
  parseProcessResult,
  pollStatus,
  settingsResponseSchema,
  state,
  statusScreenSchema,
} from '../shared/api';
import type {
  CheckStateRequest,
  SettingsResponse,
  SigningStateRequest,
  StartStateRequest,
  StatusScreen,
} from '../shared/api';
import type { StateFiles } from '../shared/api/types';
import { defaultSettings } from './model';
import { readRequestId, requestWithRetry } from './network';

export interface RequestOptions {
  inquiryId: string;
  settings: SettingsResponse;
  signal: AbortSignal;
}

type CheckPayload = Pick<CheckStateRequest, 'test_document' | 'certificates'>;
type SigningPayload = Pick<SigningStateRequest, 'documents' | 'certificates'>;

export type SignedEvent =
  | { event: 'check'; payload: CheckPayload; files: StateFiles }
  | { event: 'signing'; payload: SigningPayload; files: StateFiles };

export class ProcessRequestError extends Error {
  constructor(
    readonly key: string,
    readonly requestId?: string,
    readonly unauthorized = false,
  ) {
    super(key);
  }
}

function requestBody(inquiryId: string): StartStateRequest {
  return {
    inquiry_id: inquiryId,
    req_time: new Date().toISOString(),
    sc_name: 'urn:front-corp-digital-id-microfront',
    sp_name: 'urn:corp-digital-id',
  };
}

// Применяет retry и переводит HTTP-сбои в ошибки, по которым сценарий выбирает действие.
async function sendRequest<T>(
  send: () => Promise<T>,
  { settings, signal }: RequestOptions,
  { document = false, retryTimeout = true } = {},
) {
  try {
    const response = await requestWithRetry(
      send,
      settings,
      signal,
      retryTimeout,
    );
    signal.throwIfAborted();
    return response;
  } catch (error) {
    signal.throwIfAborted();
    const response = isAxiosError(error) ? error.response : undefined;
    const status = response?.status;
    const requestId = readRequestId(response);

    if (status === 401)
      throw new ProcessRequestError('RESPONSE_ERROR', requestId, true);
    if (status === 503 || (status === 403 && !document)) {
      throw new ProcessRequestError('SERVICE_UNAVAL', requestId);
    }
    throw new ProcessRequestError(
      document ? 'RESPONSE_DOC_DOWNLOAD_ERROR' : 'RESPONSE_ERROR',
      requestId,
    );
  }
}

// Валидирует тело ответа. HTTP 303 допустим только для запроса state с ответом task.
function readProcessResponse(
  response: AxiosResponse<unknown>,
  allowTask303: boolean,
) {
  const result = parseProcessResult(response.data);
  const requestId = readRequestId(response);
  if (
    !result.success ||
    (response.status !== 200 &&
      !(allowTask303 && response.status === 303 && result.data.kind === 'task'))
  ) {
    throw new ProcessRequestError('RESPONSE_ERROR', requestId);
  }
  return { data: result.data, requestId };
}

async function sendState(
  send: () => Promise<AxiosResponse<unknown>>,
  options: RequestOptions,
  retryTimeout = true,
) {
  const response = await sendRequest(send, options, { retryTimeout });
  return readProcessResponse(response, true);
}

export type ProcessReply = ReturnType<typeof readProcessResponse>;

export async function loadSettings(signal: AbortSignal) {
  try {
    const response = await getSettings('settings', signal);
    const parsed = settingsResponseSchema.safeParse(response.data);
    if (response.status === 200 && parsed.success) return parsed.data;
  } catch {
    // При недоступном справочнике используем весь набор значений по умолчанию.
  }
  return defaultSettings;
}

export async function loadErrorScreen(
  key: string | undefined,
  signal: AbortSignal,
): Promise<StatusScreen> {
  if (!key) return localFallback;
  try {
    const response = await getSettings(key, signal);
    const parsed = statusScreenSchema.safeParse(response.data);
    if (
      response.status === 200 &&
      parsed.success &&
      parsed.data.screen.level === 'WARNING'
    ) {
      return parsed.data;
    }
  } catch {
    // Ошибка справочника сразу ведёт к локальному STATUS.
  }
  return localFallback;
}

export function requestStart(options: RequestOptions) {
  const body = requestBody(options.inquiryId);
  return sendState(() => state('start', body, options.signal), options);
}

export function requestReady(options: RequestOptions) {
  const body = requestBody(options.inquiryId);
  return sendState(() => state('ready', body, options.signal), options);
}

// Один запрос статуса. Интервал между запросами задаёт цикл в polling.ts.
export async function requestPoll(task: string, options: RequestOptions) {
  const body = { ...requestBody(options.inquiryId), task };
  const response = await sendRequest(
    () => pollStatus(body, options.signal),
    options,
  );
  return readProcessResponse(response, false);
}

// Повторы отправляют те же файлы с тем же req_time. Локальный timeout завершает операцию.
export function requestCheck(
  { payload, files }: Extract<SignedEvent, { event: 'check' }>,
  options: RequestOptions,
) {
  const body = { ...requestBody(options.inquiryId), ...payload };
  return sendState(
    () => state('check', body, files, options.signal),
    options,
    false,
  );
}

export function requestSigning(
  { payload, files }: Extract<SignedEvent, { event: 'signing' }>,
  options: RequestOptions,
) {
  const body = { ...requestBody(options.inquiryId), ...payload };
  return sendState(
    () => state('signing', body, files, options.signal),
    options,
    false,
  );
}

export async function requestDocument(
  documentId: string,
  options: RequestOptions,
) {
  const body = { ...requestBody(options.inquiryId), document_id: documentId };
  const { document_id, title, format, base64 } = await sendRequest(
    () => getDocument(body, options.signal),
    options,
    { document: true },
  );
  const invalidDocument = () =>
    new ProcessRequestError('RESPONSE_DOC_DOWNLOAD_ERROR');
  if (document_id !== documentId) throw invalidDocument();

  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw invalidDocument();
  }
  if (!binary.length) throw invalidDocument();
  return { title, format, binary };
}
