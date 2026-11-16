import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { initialState, saveResponse, showFallback, showScreen } from './model';
import { getCryptoErrorCode, getCryptoErrorKey } from './network';
import { pollUntilProcess } from './polling';
import {
  loadErrorScreen,
  loadSettings,
  ProcessRequestError,
  requestCheck,
  requestDocument,
  requestReady,
  requestSigning,
  requestStart,
} from './requests';
import type { ProcessReply, RequestOptions, SignedEvent } from './requests';
import type { SettingScreen } from '../shared/api';
import type { ProcessState } from './model';

export type HasSettingCache = (
  inquiryId: string,
  response: SettingScreen,
  signal: AbortSignal,
) => Promise<boolean>;

function resetProcess(
  previous: ProcessState,
  screen = initialState(previous.inquiryId).screen,
  busy = false,
) {
  const next = initialState(previous.inquiryId);
  return {
    ...showScreen({ ...next, screen: previous.screen }, screen),
    busy,
  };
}

// Хранит состояние заявки и связывает команды экранов с сетевыми функциями.
export function useProcess(
  inquiryId: string,
  hasSettingCache?: HasSettingCache,
) {
  const [state, setState] = useState(() => initialState(inquiryId));
  const activeRequest = useRef<AbortController>();
  const restartedAfter401 = useRef(false);

  const stop = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = undefined;
  }, []);

  // При размонтировании, в том числе при смене заявки, отменяем текущую операцию.
  useLayoutEffect(() => stop, [stop]);

  // Ответ с task запускает polling. Ответ с process определяет следующий экран.
  const applyResponse = useCallback(
    async (reply: ProcessReply, options: RequestOptions) => {
      const { signal } = options;
      while (!signal.aborted) {
        const { data, requestId } = reply;
        if (data.kind === 'task') {
          reply = await pollUntilProcess(data.response, options, (task) => {
            setState((previous) => {
              const next = saveResponse(previous, task);
              return previous.screen.process === 'WAITING'
                ? next
                : showScreen(next, { process: 'WAITING' });
            });
          });
          continue;
        }
        if (data.kind === 'unsupported-mode') {
          setState((previous) =>
            showScreen(previous, { ...data.fallback }, requestId),
          );
          return;
        }

        const screen = data.response;
        if (screen.process === 'SETTING' && hasSettingCache) {
          // Session доступна в Context ещё до завершения проверки кэша.
          setState((previous) => saveResponse(previous, screen));
          let cached = false;
          try {
            cached = await hasSettingCache(inquiryId, screen, signal);
          } catch {
            // Если кэш недоступен, открываем SETTING для ручной проверки.
          }
          signal.throwIfAborted();
          if (cached) {
            reply = await requestReady(options);
            continue;
          }
        }

        const errorRequestId =
          screen.process === 'STATUS' && screen.screen.level !== 'SUCCESS'
            ? requestId
            : undefined;
        setState((previous) =>
          showScreen(saveResponse(previous, screen), screen, errorRequestId),
        );
        return;
      }
    },
    [hasSettingCache, inquiryId],
  );

  // Сначала получаем настройки, чтобы уже запрос start использовал их для retry.
  const handleStart = useCallback(
    async (signal: AbortSignal) => {
      const settings = await loadSettings(signal);
      signal.throwIfAborted();
      setState((previous) => ({ ...previous, settings }));
      const options = { inquiryId, settings, signal };
      const reply = await requestStart(options);
      await applyResponse(reply, options);
    },
    [applyResponse, inquiryId],
  );

  // Загружаем текст ошибки из справочника и показываем ID исходного запроса.
  const showError = useCallback(
    async (
      key: string | undefined,
      signal: AbortSignal,
      requestId?: string,
    ) => {
      const screen = await loadErrorScreen(key, signal);
      if (!signal.aborted) {
        setState((previous) =>
          showScreen(previous, { ...screen }, requestId, key),
        );
      }
    },
    [],
  );

  // Общий запуск команд: управляет busy, отменой и обработкой сетевых ошибок.
  const run = useCallback(
    async <T>(handleRequest: (signal: AbortSignal) => Promise<T>) => {
      // Блокируем двойной клик сразу. busy нужен для отображения в React.
      if (!inquiryId || activeRequest.current) return;
      const controller = new AbortController();
      const { signal } = controller;
      activeRequest.current = controller;
      setState((previous) => ({ ...previous, busy: true }));
      let request: (signal: AbortSignal) => Promise<T | void> = handleRequest;

      try {
        while (!signal.aborted) {
          try {
            const result = await request(signal);
            if (!signal.aborted) return result;
          } catch (error) {
            if (signal.aborted) return;
            if (!(error instanceof ProcessRequestError)) {
              setState(showFallback);
              return;
            }
            // После первого 401 начинаем START заново. При повторном показываем ошибку.
            if (error.unauthorized && !restartedAfter401.current) {
              restartedAfter401.current = true;
              setState((previous) =>
                resetProcess(previous, { process: 'START' }, true),
              );
              request = handleStart;
              continue;
            }
            if (error.unauthorized) {
              setState((previous) => ({
                ...resetProcess(previous, { process: 'WAITING' }, true),
                settings: previous.settings,
              }));
            }
            await showError(error.key, signal, error.requestId);
            return;
          }
        }
      } finally {
        if (activeRequest.current === controller) {
          activeRequest.current = undefined;
          setState((previous) => ({ ...previous, busy: false }));
        }
      }
    },
    [handleStart, inquiryId, showError],
  );

  const start = useCallback(() => {
    if (state.screen.process === 'START') return run(handleStart);
  }, [handleStart, run, state.screen.process]);

  const restart = useCallback(() => {
    stop();
    setState(resetProcess);
    return run(handleStart);
  }, [handleStart, run, stop]);

  const { backScreen } = state;
  // BACK восстанавливает сохранённый рабочий экран без повторной отправки.
  const back = useCallback(
    (manual = true) => {
      if (manual) restartedAfter401.current = false;
      if (!backScreen) return restart();
      stop();
      setState((previous) =>
        showScreen({ ...previous, busy: false }, backScreen),
      );
    },
    [backScreen, restart, stop],
  );

  const retry = () => {
    restartedAfter401.current = false;
    return restart();
  };

  const recoverFromRenderError = () => {
    if (!inquiryId) return;
    stop();
    setState((previous) => showFallback({ ...previous, busy: false }));
  };

  const ready = () => {
    if (state.screen.process !== 'SETTING') return;
    return run(async (signal) => {
      const options = { inquiryId, settings: state.settings, signal };
      const reply = await requestReady(options);
      await applyResponse(reply, options);
    });
  };

  async function handleCheck(
    signed: Extract<SignedEvent, { event: 'check' }>,
    options: RequestOptions,
  ) {
    const reply = await requestCheck(signed, options);
    await applyResponse(reply, options);
  }

  async function handleSigning(
    signed: Extract<SignedEvent, { event: 'signing' }>,
    options: RequestOptions,
  ) {
    const reply = await requestSigning(signed, options);
    await applyResponse(reply, options);
  }

  // Подготавливаем подпись один раз. Сетевые повторы отправляют готовые файлы.
  const submitSignature = (
    prepare: (signal: AbortSignal) => Promise<SignedEvent>,
  ) => {
    const { process } = state.screen;
    if (process !== 'CHECK' && process !== 'SIGNING') return;
    return run(async (signal) => {
      let signed: SignedEvent;
      try {
        signed = await prepare(signal);
      } catch (error) {
        if (!signal.aborted) {
          await showError(
            getCryptoErrorKey(getCryptoErrorCode(error), 'signing'),
            signal,
          );
        }
        return;
      }
      signal.throwIfAborted();
      const options = { inquiryId, settings: state.settings, signal };
      if (process === 'CHECK' && signed.event === 'check') {
        await handleCheck(signed, options);
      } else if (process === 'SIGNING' && signed.event === 'signing') {
        await handleSigning(signed, options);
      } else {
        setState(showFallback);
      }
    });
  };

  const downloadDocument = (documentId: string) => {
    if (state.screen.process !== 'SIGNING') return;
    return run((signal) =>
      requestDocument(documentId, {
        inquiryId,
        settings: state.settings,
        signal,
      }),
    );
  };

  const reportCryptoError = (code: string, stage: 'setup' | 'signing') =>
    run((signal) => showError(getCryptoErrorKey(code, stage), signal));

  return {
    state,
    commands: {
      start,
      retry,
      back,
      ready,
      submitSignature,
      downloadDocument,
      reportCryptoError,
      recoverFromRenderError,
    },
  };
}
