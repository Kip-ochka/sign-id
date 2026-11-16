import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { prepareCheck } from '../screens/check/prepareCheck';
import {
  checkCsp,
  checkWorkplace,
  getSettingStages,
} from '../screens/setting/checkWorkplace';
import type {
  SettingStage,
  WorkplaceResult,
} from '../screens/setting/checkWorkplace';
import { prepareSigning } from '../screens/signing/prepareSigning';
import { localFallback } from '../shared/api';
import type { CheckScreen, SigningScreen } from '../shared/api';
import { findCertificates } from '../shared/services/cryptoPro/adapter';
import { checkBrowserPlugin } from '../shared/services/cryptoPro/workplace';
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
import { createSettingCache } from './settingCache';
import type { SettingCache } from './settingCache';
import type { ProcessState } from './model';

const defaultSettingCache = createSettingCache(() =>
  typeof window === 'undefined' ? undefined : window.navigator.userAgent,
);

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
  settingCache: SettingCache = defaultSettingCache,
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

  const showSetupError = useCallback(
    (code: string, signal: AbortSignal) => {
      if (signal.aborted) return;
      if (code === 'CSP_VERSION_TOO_LOW') {
        setState((previous) =>
          showScreen(previous, {
            ...localFallback,
            screen: {
              ...localFallback.screen,
              title: 'Версия КриптоПро CSP не подходит',
              message:
                'Установите КриптоПро CSP версии 5.0 или выше и повторите проверку.',
            },
          }),
        );
        return;
      }
      return showError(getCryptoErrorKey(code, 'setup'), signal);
    },
    [showError],
  );

  // Вход и BACK всегда загружают актуальную выборку сертификатов.
  const openSignatureScreen = useCallback(
    async (screen: CheckScreen | SigningScreen, signal: AbortSignal) => {
      setState((previous) => showScreen(previous, screen));
      try {
        if (screen.process === 'SIGNING') {
          await checkBrowserPlugin();
          signal.throwIfAborted();
          await checkCsp();
          signal.throwIfAborted();
        }
        const signatureCertificates = await findCertificates(
          screen.cryptopro.filters,
        );
        if (signal.aborted) return;
        if (!signatureCertificates.length)
          return showSetupError('NO_CERT', signal);
        setState((previous) => ({ ...previous, signatureCertificates }));
      } catch (error) {
        await showSetupError(getCryptoErrorCode(error), signal);
      }
    },
    [showSetupError],
  );

  // Ответ с task запускает polling. Ответ с process определяет следующий экран.
  const applyResponse = useCallback(
    async (reply: ProcessReply, options: RequestOptions, readySent = false) => {
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
        if (screen.process === 'CHECK' || screen.process === 'SIGNING') {
          setState((previous) => saveResponse(previous, screen));
          await openSignatureScreen(screen, signal);
          return;
        }
        if (screen.process === 'SETTING') {
          const stages = getSettingStages(screen);
          if (stages.length === 0 || readySent) {
            setState(showFallback);
            return;
          }
          // Сохраняем session, оставляя текущий экран до решения по кэшу.
          setState((previous) => ({
            ...saveResponse(previous, screen),
            settingProgress: undefined,
            workplaceCertificates: undefined,
          }));
          let cached = false;
          try {
            cached = await settingCache.has(inquiryId, stages);
          } catch {
            // Если кэш недоступен, открываем SETTING для ручной проверки.
          }
          signal.throwIfAborted();
          if (cached) {
            reply = await requestReady(options);
            readySent = true;
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
    [inquiryId, openSignatureScreen, settingCache],
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
          setState((previous) => ({
            ...previous,
            busy: false,
            signaturePhase: undefined,
          }));
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
      if (backScreen.process === 'CHECK' || backScreen.process === 'SIGNING') {
        return run((signal) => openSignatureScreen(backScreen, signal));
      }
      setState((previous) =>
        showScreen({ ...previous, busy: false }, backScreen),
      );
    },
    [backScreen, openSignatureScreen, restart, run, stop],
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

  const checkSetting = () => {
    const { screen, settings } = state;
    if (screen.process !== 'SETTING') return;
    const stages = getSettingStages(screen);
    if (stages.length === 0) return;
    return run(async (signal) => {
      setState((previous) => ({
        ...previous,
        settingProgress: undefined,
        workplaceCertificates: undefined,
      }));
      const update = (stage: SettingStage, result: WorkplaceResult) =>
        setState((previous) => ({
          ...previous,
          settingProgress: { ...previous.settingProgress, [stage]: result },
        }));
      const result = await checkWorkplace(
        screen,
        stages,
        signal,
        (stage, progress) => update(stage, { state: progress }),
        (stage, error) =>
          update(stage, { state: 'ERROR', code: getCryptoErrorCode(error) }),
      );
      if (!result || signal.aborted) return;

      settingCache.save(inquiryId, stages);
      setState((previous) => ({
        ...previous,
        workplaceCertificates: result.certificates,
      }));
      const options = { inquiryId, settings, signal };
      const reply = await requestReady(options);
      await applyResponse(reply, options, true);
    });
  };

  const showSettingError = (stage: SettingStage) => {
    const result = state.settingProgress?.[stage];
    if (state.screen.process !== 'SETTING' || result?.state !== 'ERROR') return;
    return run(async (signal) => showSetupError(result.code, signal));
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
      setState((previous) => ({ ...previous, signaturePhase: 'sending' }));
      if (process === 'CHECK' && signed.event === 'check') {
        await handleCheck(signed, options);
      } else if (process === 'SIGNING' && signed.event === 'signing') {
        await handleSigning(signed, options);
      } else {
        setState(showFallback);
      }
    });
  };

  const submitSelectedCertificate = (thumbprint: string) => {
    const { screen, signatureCertificates } = state;
    if (
      (screen.process !== 'CHECK' && screen.process !== 'SIGNING') ||
      !signatureCertificates?.some(
        (certificate) => certificate.thumbprint === thumbprint,
      )
    )
      return;
    return submitSignature((signal) => {
      setState((previous) => ({ ...previous, signaturePhase: 'signing' }));
      return screen.process === 'CHECK'
        ? prepareCheck(screen, thumbprint)
        : prepareSigning(screen, thumbprint, signal);
    });
  };

  const downloadDocument = (documentId: string) => {
    const { screen, settings } = state;
    if (
      screen.process !== 'SIGNING' ||
      !screen.screen.lists.documents.some(({ id }) => id === documentId)
    )
      return;
    return run((signal) =>
      requestDocument(documentId, {
        inquiryId,
        settings,
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
      checkSetting,
      showSettingError,
      submitCheck: (thumbprint: string) => {
        if (state.screen.process === 'CHECK')
          return submitSelectedCertificate(thumbprint);
      },
      submitSigning: (thumbprint: string) => {
        if (state.screen.process === 'SIGNING')
          return submitSelectedCertificate(thumbprint);
      },
      submitSignature,
      downloadDocument,
      reportCryptoError,
      recoverFromRenderError,
    },
  };
}
