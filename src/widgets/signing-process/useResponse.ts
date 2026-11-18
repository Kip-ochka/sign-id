import { useCallback } from 'react';
import { saveResponse, showFallback, showScreen } from '../../entities/signing';
import { sessionStorage } from '../../entities/signing';
import { requestReady } from '../../entities/signing';
import type { ProcessReply, RequestOptions } from '../../entities/signing';
import type { UpdateProcess, ShowSetupError } from '../../entities/signing';
import type { CheckScreen, SigningScreen } from '../../shared/api';
import { findCertificates } from '../../shared/services/cryptoPro/adapter';
import { checkBrowserPlugin } from '../../shared/services/cryptoPro/workplace';
import { getCryptoErrorCode } from '../../shared/lib/cryptoErrors';
import { checkCsp } from '../../process/setting';
import type { SettingCache } from '../../process/setting';
import { pollUntilProcess } from '../../process/polling';

export function useResponse(
  inquiryId: string,
  settingCache: SettingCache,
  setState: UpdateProcess,
  showSetupError: ShowSetupError,
) {
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
        if (signal.aborted) {
          return undefined;
        }
        if (!signatureCertificates.length) {
          return showSetupError('NO_CERT', options);
        }
        setState((previous) => ({ ...previous, signatureCertificates }));
      } catch (error) {
        await showSetupError(getCryptoErrorCode(error), options);
      }
      return undefined;
    },
    [showSetupError, setState],
  );

  // Ответ с task запускает polling. Ответ с process определяет следующий экран.
  const applyResponse = useCallback(
    async function applyReply(
      reply: ProcessReply,
      options: RequestOptions,
      readySent = false,
    ): Promise<void> {
      const { signal } = options;
      if (signal.aborted) {
        return undefined;
      }
      const { data, requestId } = reply;
      if (data.kind === 'task') {
        const next = await pollUntilProcess(data.response, options, (task) => {
          setState((previous) => {
            const next = saveResponse(previous, task);
            if (previous.screen.process === 'WAITING') {
              return next;
            }
            return showScreen(next, { process: 'WAITING' });
          });
        });
        return applyReply(next, options, readySent);
      }
      if (data.kind === 'unsupported-mode') {
        setState((previous) =>
          showScreen(previous, { ...data.fallback }, requestId),
        );
        return undefined;
      }

      const screen = data.response;
      if (screen.process === 'CHECK' || screen.process === 'SIGNING') {
        setState((previous) => saveResponse(previous, screen));
        await openSignatureScreen(screen, options);
        return undefined;
      }
      if (screen.process === 'SETTING') {
        // ready по кэшу использует новую сессию в той же операции.
        sessionStorage.save(screen.session);
        options.session = screen.session;
        if (readySent) {
          setState((previous) => showFallback(saveResponse(previous, screen)));
          return undefined;
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
      return undefined;
    },
    [inquiryId, openSignatureScreen, settingCache, setState],
  );

  return { applyResponse, openSignatureScreen };
}
