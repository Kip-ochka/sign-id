import { useCallback, useLayoutEffect, useRef } from 'react';
import { sessionStorage } from '../../entities/signing';
import { resetProcess, showFallback } from '../../entities/signing';
import type { ProcessState } from '../../entities/signing';
import { ProcessRequestError } from '../../entities/signing';
import type { RequestOptions } from '../../entities/signing';
import type { UpdateProcess, ShowError } from '../../entities/signing';

export function useOperation(
  state: ProcessState,
  setState: UpdateProcess,
  handleStart: (options: RequestOptions) => Promise<void>,
  showError: ShowError,
) {
  const { inquiryId } = state;
  const activeRequest = useRef<AbortController>();
  const restartedAfter401 = useRef(false);
  const stop = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = undefined;
  }, []);

  // При размонтировании, в том числе при смене заявки, отменяем текущую операцию.
  useLayoutEffect(() => stop, [stop]);

  // Общий запуск команд: управляет busy, отменой и обработкой сетевых ошибок.
  const run = useCallback(
    async <T>(handleRequest: (options: RequestOptions) => Promise<T>) => {
      // Блокируем двойной клик сразу. busy нужен для отображения в React.
      if (!inquiryId || activeRequest.current) {
        return undefined;
      }
      const controller = new AbortController();
      const { signal } = controller;
      let sessionDisabled = state.session === null;
      const options: RequestOptions = {
        inquiryId,
        settings: state.settings,
        get session() {
          return sessionDisabled ? null : (sessionStorage.read() ?? null);
        },
        set session(value: string | null) {
          sessionDisabled = value === null;
          if (sessionDisabled) {
            sessionStorage.clear();
          }
        },
        token: state.token,
        signal,
        onUnauthorized: () => {
          if (signal.aborted) {
            return;
          }
          options.session = null;
          options.token = undefined;
          setState((previous) => ({ ...previous, session: null }));
        },
      };
      activeRequest.current = controller;
      setState((previous) => ({ ...previous, busy: true }));
      async function executeRequest(
        request: (options: RequestOptions) => Promise<T | void>,
      ): Promise<T | void> {
        if (signal.aborted) {
          return undefined;
        }
        try {
          const result = await request(options);
          if (!signal.aborted) {
            return result;
          }
        } catch (error) {
          if (signal.aborted) {
            return undefined;
          }
          if (!(error instanceof ProcessRequestError)) {
            setState(showFallback);
            return undefined;
          }
          // После первого 401 начинаем START заново. При повторном показываем ошибку.
          if (error.unauthorized && !restartedAfter401.current) {
            restartedAfter401.current = true;
            setState((previous) =>
              resetProcess(previous, { process: 'START' }, true),
            );
            return executeRequest(handleStart);
          }
          if (error.unauthorized) {
            setState((previous) => ({
              ...resetProcess(previous, { process: 'WAITING' }, true),
              settings: previous.settings,
            }));
          }
          await showError(error.key, options, error.requestId);
          return undefined;
        }
        return undefined;
      }
      try {
        return await executeRequest(handleRequest);
      } finally {
        if (activeRequest.current === controller) {
          activeRequest.current = undefined;
          setState((previous) => ({
            ...previous,
            busy: false,
            signaturePhase: undefined,
          }));
        }
      }
    },
    [
      handleStart,
      inquiryId,
      showError,
      state.session,
      state.settings,
      state.token,
      setState,
    ],
  );

  const allowManualRestart = useCallback(() => {
    restartedAfter401.current = false;
  }, []);
  return { run, stop, allowManualRestart };
}
