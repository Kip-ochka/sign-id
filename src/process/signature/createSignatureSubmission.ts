import type {
  ProcessState,
  UpdateProcess,
  RunOperation,
  ApplyResponse,
  ShowError,
  SignedEvent,
  RequestOptions,
} from '../../entities/signing';
import {
  showFallback,
  requestCheck,
  requestSigning,
} from '../../entities/signing';
import {
  getCryptoErrorCode,
  getCryptoErrorKey,
} from '../../shared/lib/cryptoErrors';

export function createSignatureSubmission(
  state: ProcessState,
  setState: UpdateProcess,
  run: RunOperation,
  applyResponse: ApplyResponse,
  showError: ShowError,
) {
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
    if (process !== 'CHECK' && process !== 'SIGNING') {
      return undefined;
    }
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

  return submitSignature;
}
