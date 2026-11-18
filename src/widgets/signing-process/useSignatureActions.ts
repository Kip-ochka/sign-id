import type {
  ProcessState,
  UpdateProcess,
  RunOperation,
  ApplyResponse,
  ShowError,
} from '../../entities/signing';
import { prepareCheck } from '../../process/check';
import { prepareSigning } from '../../process/signing';
import { createSignatureSubmission } from '../../process/signature';

export function useSignatureActions(
  state: ProcessState,
  setState: UpdateProcess,
  run: RunOperation,
  applyResponse: ApplyResponse,
  showError: ShowError,
) {
  const submitSignature = createSignatureSubmission(
    state,
    setState,
    run,
    applyResponse,
    showError,
  );
  const submitSelectedCertificate = (thumbprint: string) => {
    const { screen, signatureCertificates } = state;
    if (
      (screen.process !== 'CHECK' && screen.process !== 'SIGNING') ||
      !signatureCertificates?.some(
        (certificate) => certificate.thumbprint === thumbprint,
      )
    ) {
      return undefined;
    }
    return submitSignature((signal) => {
      setState((previous) => ({ ...previous, signaturePhase: 'signing' }));
      if (screen.process === 'CHECK') {
        return prepareCheck(screen, thumbprint, signal);
      }
      return prepareSigning(screen, thumbprint, signal);
    });
  };

  return {
    submitCheck: (thumbprint: string) => {
      if (state.screen.process === 'CHECK') {
        return submitSelectedCertificate(thumbprint);
      }
      return undefined;
    },
    submitSigning: (thumbprint: string) => {
      if (state.screen.process === 'SIGNING') {
        return submitSelectedCertificate(thumbprint);
      }
      return undefined;
    },
  };
}
