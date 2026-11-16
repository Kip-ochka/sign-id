import { AxiosHeaders, isAxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

import { getHttpAttemptLimit } from '../shared/api';
import type { SettingsResponse } from '../shared/api';
import { errorsBase, signingErrorOverrides } from '../shared/errorsBase';

const maxTimerDelay = 2_147_483_647;

export function schedule(callback: () => void, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout>;
  function next(remaining: number) {
    const delay = Math.min(remaining, maxTimerDelay);
    timer = setTimeout(() => {
      if (remaining > delay) next(remaining - delay);
      else callback();
    }, delay);
  }
  next(milliseconds);
  return () => clearTimeout(timer);
}

export function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = schedule(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    function abort() {
      cancel();
      reject(signal.reason);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function requestWithRetry<T>(
  request: () => Promise<T>,
  settings: SettingsResponse,
  signal: AbortSignal,
  retryTimeout: boolean,
) {
  const limit = getHttpAttemptLimit(settings);
  for (let attempt = 1; ; attempt += 1) {
    signal.throwIfAborted();
    try {
      return await request();
    } catch (error) {
      signal.throwIfAborted();
      const retryable =
        isAxiosError(error) &&
        (error.response?.status === 429 ||
          error.response?.status === 504 ||
          (retryTimeout &&
            !error.response &&
            (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')));
      if (!retryable || attempt >= limit) throw error;

      const { retry_time, retry_addition } = settings;
      const jitter = retry_addition
        ? 1 + Math.floor(Math.random() * retry_addition)
        : 0;
      await wait(retry_time + jitter, signal);
    }
  }
}

export function readRequestId(response?: AxiosResponse<unknown>) {
  const value =
    response &&
    AxiosHeaders.from(response.headers as AxiosHeaders).get('x-request-id');
  return typeof value === 'string' ? value : undefined;
}

export function getCryptoErrorCode(error: unknown) {
  if (typeof error === 'string') return error;
  if (!(error instanceof Error)) return '';
  if ('code' in error && typeof error.code === 'string' && error.code) {
    return error.code;
  }
  return error.message;
}

export function getCryptoErrorKey(code: string, stage: 'setup' | 'signing') {
  if (code === 'NO_CERT') return code;

  // HRESULT из разных адаптеров может отличаться регистром.
  const key = /^0x[0-9a-f]+$/i.test(code)
    ? '0x' + code.slice(2).toUpperCase()
    : code;
  if (stage === 'signing' && Object.hasOwn(signingErrorOverrides, key)) {
    return signingErrorOverrides[key];
  }
  return Object.hasOwn(errorsBase, key)
    ? (errorsBase[key] ?? undefined)
    : undefined;
}
