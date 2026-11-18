import { toCertificateList } from '../../entities/signing';
import {
  useSigningProcess,
  useSigningNavigation,
} from '../../widgets/signing-process';
import { SigningDocuments } from '../../widgets/signing-documents';

export function SigningScreen() {
  const { current } = useSigningNavigation();
  const { state, commands } = useSigningProcess();
  if (current.process !== 'SIGNING') {
    return null;
  }
  const certificates = toCertificateList(state.signatureCertificates);
  return (
    <SigningDocuments
      key={certificates.status}
      response={current}
      busy={state.busy}
      phase={state.signaturePhase}
      certificates={certificates}
      onSign={({ id }) => {
        commands.submitSigning(id);
      }}
      downloadDocument={commands.downloadDocument}
    />
  );
}
