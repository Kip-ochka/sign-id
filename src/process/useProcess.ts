import { sessionStorage } from './sessionStorage';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { prepareCheck } from '../screens/check/prepareCheck';
import { checkCsp, checkWorkplace } from '../screens/setting/checkWorkplace';
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
import { getCryptoErrorCode, getCryptoErrorKey, schedule } from './network';
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
    session: previous.session === null ? null : undefined,
    busy,
  };
}

// Хранит состояние заявки и связывает команды экранов с сетевыми функциями.
export function useProcess(
  inquiryId: string,
  settingCache: SettingCache = defaultSettingCache,
) {
  const [state, setState] = useState<ProcessState>(() => ({
    ...initialState(inquiryId),
    session: inquiryId ? sessionStorage.read() : undefined,
  }));
  const activeRequest = useRef<AbortController>();
  const restartedAfter401 = useRef(false);

  useLayoutEffect(() => {
    const session = state.session;
    if (!session) return;
    const entry = sessionStorage.readEntry();
    let cancel: () => void;
    const expire = () => {
      const current = sessionStorage.readEntry();
      // Повторный SETTING может продлить срок даже для прежнего session id.
      if (current?.id === session) {
        cancel = schedule(expire, Math.max(0, current.expiresAt - Date.now()));
        return;
      }
      setState((previous) =>
        previous.session === session
          ? { ...previous, session: current?.id }
          : previous,
      );
    };
    cancel = schedule(
      expire,
      Math.max(0, (entry?.expiresAt ?? Date.now()) - Date.now()),
    );
    return () => cancel();
  }, [state.session, state.lastResponse]);

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
      options: RequestOptions,
      requestId?: string,
    ) => {
      const screen = await loadErrorScreen(key, options);
      if (!options.signal.aborted) {
        setState((previous) =>
          showScreen(previous, { ...screen }, requestId, key),
        );
      }
    },
    [],
  );

  const showSetupError = useCallback(
    (code: string, options: RequestOptions) => {
      if (options.signal.aborted) return;
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
      return showError(getCryptoErrorKey(code, 'setup'), options);
    },
    [showError],
  );

  // Вход и BACK всегда загружают актуальную выборку сертификатов.
  const openSignatureScreen = useCallback(
    async (screen: CheckScreen | SigningScreen, options: RequestOptions) => {
      const { signal } = options;
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
          return showSetupError('NO_CERT', options);
        setState((previous) => ({ ...previous, signatureCertificates }));
      } catch (error) {
        await showSetupError(getCryptoErrorCode(error), options);
      }
    },
    [showSetupError],
  );

  // Ответ с task запускает polling. Ответ с process определяет следующий экран.
  const applyResponse = useCallback(
    async function applyReply(
      reply: ProcessReply,
      options: RequestOptions,
      readySent = false,
    ): Promise<void> {
      const { signal } = options;
      if (signal.aborted) return;
      const { data, requestId } = reply;
      if (data.kind === 'task') {
        const next = await pollUntilProcess(data.response, options, (task) => {
          setState((previous) => {
            const next = saveResponse(previous, task);
            if (previous.screen.process === 'WAITING') return next;
            return showScreen(next, { process: 'WAITING' });
          });
        });
        return applyReply(next, options, readySent);
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
        await openSignatureScreen(screen, options);
        return;
      }
      if (screen.process === 'SETTING') {
        // ready по кэшу использует новую сессию в той же операции.
        sessionStorage.save(screen.session);
        options.session = screen.session;
        if (readySent) {
          setState((previous) => showFallback(saveResponse(previous, screen)));
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
          cached = await settingCache.has(inquiryId);
        } catch {
          // Если кэш недоступен, открываем SETTING для ручной проверки.
        }
        signal.throwIfAborted();
        if (cached) {
          const next = await requestReady(options);
          return applyReply(next, options, true);
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
    },
    [inquiryId, openSignatureScreen, settingCache],
  );

  // Сначала получаем настройки, чтобы уже запрос start использовал их для retry.
  const handleStart = useCallback(
    async (options: RequestOptions) => {
      const settings = await loadSettings(options);
      options.signal.throwIfAborted();
      options.settings = settings;
      setState((previous) => ({ ...previous, settings }));
      const reply = await requestStart(options);
      await applyResponse(reply, options);
    },
    [applyResponse],
  );

  // Общий запуск команд: управляет busy, отменой и обработкой сетевых ошибок.
  const run = useCallback(
    async <T>(handleRequest: (options: RequestOptions) => Promise<T>) => {
      // Блокируем двойной клик сразу. busy нужен для отображения в React.
      if (!inquiryId || activeRequest.current) return;
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
          if (sessionDisabled) sessionStorage.clear();
        },
        token: state.token,
        signal,
        onUnauthorized: () => {
          if (signal.aborted) return;
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
        if (signal.aborted) return;
        try {
          const result = await request(options);
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
            return executeRequest(handleStart);
          }
          if (error.unauthorized) {
            setState((previous) => ({
              ...resetProcess(previous, { process: 'WAITING' }, true),
              settings: previous.settings,
            }));
          }
          await showError(error.key, options, error.requestId);
          return;
        }
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
    ],
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
        return run((options) => openSignatureScreen(backScreen, options));
      }
      setState((previous) =>
        showScreen({ ...previous, busy: false }, backScreen),
      );
    },
    [backScreen, openSignatureScreen, restart, run, stop],
  );

  const recoverFromRenderError = () => {
    if (!inquiryId) return;
    stop();
    setState((previous) => showFallback({ ...previous, busy: false }));
  };

  const checkSetting = () => {
    const { screen } = state;
    if (screen.process !== 'SETTING') return;
    return run(async (options) => {
      const { signal } = options;
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
        signal,
        (stage, progress) => update(stage, { state: progress }),
        async (stage, error) => {
          const code = getCryptoErrorCode(error);
          update(stage, { state: 'ERROR', code });
          if (
            !screen.screen.lists?.testing?.some(({ name }) => name === stage)
          ) {
            await showSetupError(code, options);
          }
        },
      );
      if (!result || signal.aborted) return;

      settingCache.save(inquiryId);
      setState((previous) => ({
        ...previous,
        workplaceCertificates: result.certificates,
      }));
      const reply = await requestReady(options);
      await applyResponse(reply, options, true);
    });
  };

  const showSettingError = (stage: SettingStage) => {
    const result = state.settingProgress?.[stage];
    if (state.screen.process !== 'SETTING' || result?.state !== 'ERROR') return;
    return run(async (options) => showSetupError(result.code, options));
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
    return run(async (options) => {
      const { signal } = options;
      let signed: SignedEvent;
      try {
        signed = await prepare(signal);
      } catch (error) {
        if (!signal.aborted) {
          await showError(
            getCryptoErrorKey(getCryptoErrorCode(error), 'signing'),
            options,
          );
        }
        return;
      }
      signal.throwIfAborted();
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
      if (screen.process === 'CHECK') {
        return prepareCheck(screen, thumbprint, signal);
      }
      return prepareSigning(screen, thumbprint, signal);
    });
  };

  const downloadDocument = (documentId: string) => {
    const { screen } = state;
    if (
      screen.process !== 'SIGNING' ||
      !screen.screen.lists.documents.some(({ id }) => id === documentId)
    )
      return;
    return run((options) => requestDocument(documentId, options));
  };

  return {
    state,
    commands: {
      start,
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
      downloadDocument,
      recoverFromRenderError,
    },
  };
}
