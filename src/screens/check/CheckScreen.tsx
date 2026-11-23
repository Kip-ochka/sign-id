import { toCertificateList } from '../../entities/signing';
import { useSigningNavigation, useSigningProcess } from '../../widgets/signing-process';
import { TestSignature } from '../../widgets/test-signature';
import { LoadingScreen } from '../../shared/ui/LoadingScreen';

export function CheckScreen() {
    const { current } = useSigningNavigation();
    const { state, commands } = useSigningProcess();
    if (current.process !== 'CHECK') {
        return null;
    }
    const certificates = toCertificateList(state.signatureCertificates);
    if (certificates.status === 'loading') {
        return <LoadingScreen />;
    }
    return (
        <TestSignature
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
