import { AxiosHeaders, isAxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import { getHttpAttemptLimit } from './process-contract';
import type { SettingsResponse } from './types';
import { wait } from '../lib/async';

export async function requestWithRetry<T>(
  request: () => Promise<T>,
  settings: SettingsResponse,
  signal: AbortSignal,
) {
  const limit = getHttpAttemptLimit(settings);
  async function attemptRequest(attempt: number): Promise<T> {
    signal.throwIfAborted();
    try {
      return await request();
    } catch (error) {
      signal.throwIfAborted();
      const retryable =
        isAxiosError(error) &&
        (error.response?.status === 429 ||
          error.response?.status === 504 ||
          (!error.response &&
            (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')));
      if (!retryable || attempt >= limit) {
        throw error;
      }

      const { retry_time, retry_addition } = settings;
      const jitter = retry_addition
        ? 1 + Math.floor(Math.random() * retry_addition)
        : 0;
      await wait(retry_time + jitter, signal);
      return attemptRequest(attempt + 1);
    }
  }
  return attemptRequest(1);
}

export function readRequestId(response?: AxiosResponse<unknown>) {
  const value =
    response &&
    AxiosHeaders.from(response.headers as AxiosHeaders).get('x-request-id');
  return typeof value === 'string' ? value : undefined;
}
