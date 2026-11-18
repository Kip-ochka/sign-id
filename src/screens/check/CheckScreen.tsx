import { toCertificateList } from '../../entities/signing';
import {
  useSigningProcess,
  useSigningNavigation,
} from '../../widgets/signing-process';
import { TestSignature } from '../../widgets/test-signature';

export function CheckScreen() {
  const { current } = useSigningNavigation();
  const { state, commands } = useSigningProcess();
  if (current.process !== 'CHECK') {
    return null;
  }
  const certificates = toCertificateList(state.signatureCertificates);
  return (
    <TestSignature
      key={certificates.status}
      response={current}
      busy={state.busy}
      phase={state.signaturePhase}
      certificates={certificates}
      onSign={({ id }) => {
        commands.submitCheck(id);
      }}
    />
  );
}
