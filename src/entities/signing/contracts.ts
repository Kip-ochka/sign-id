import type { Dispatch, SetStateAction } from 'react';
import type { ProcessState } from './model';
import type { ProcessReply, RequestOptions } from './requests';

export type UpdateProcess = Dispatch<SetStateAction<ProcessState>>;
export type RunOperation = <T>(
  handle: (options: RequestOptions) => Promise<T>,
) => Promise<T | void>;
export type ApplyResponse = (
  reply: ProcessReply,
  options: RequestOptions,
  readySent?: boolean,
) => Promise<void>;
export type ShowError = (
  key: string | undefined,
  options: RequestOptions,
  requestId?: string,
) => Promise<void>;
export type ShowSetupError = (
  code: string,
  options: RequestOptions,
) => Promise<void> | undefined;
