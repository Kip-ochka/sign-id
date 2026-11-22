import { toCertificateList } from '../../entities/signing';
import { useSigningProcess, useSigningNavigation } from '../../widgets/signing-process';
import { SigningDocuments } from '../../widgets/signing-documents';
import { LoadingScreen } from '../../shared/ui/LoadingScreen';

export function SigningScreen() {
    const { current } = useSigningNavigation();
    const { state, commands } = useSigningProcess();
    if (current.process !== 'SIGNING') {
        return null;
    }
    const certificates = toCertificateList(state.signatureCertificates);
    if (certificates.status === 'loading') {
        return <LoadingScreen />;
    }
    return (
        <SigningDocuments
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
