import {
  NavigationProvider,
  useSigningNavigation,
} from './process/NavigationContext';
import { ProcessProvider, useSigningProcess } from './process/ProcessContext';
import { ProcessErrorBoundary } from './process/ProcessErrorBoundary';
import { useStatusActions } from './process/useStatusActions';
import { CheckScreen } from './screens/check/CheckScreen';
import { SettingScreen } from './screens/setting/SettingScreen';
import type { SettingProgress } from './screens/setting/SettingScreen';
import { settingStages } from './screens/setting/checkWorkplace';
import type { CertificateList } from './screens/shared/CertificatePicker';
import { SigningDocuments } from './screens/signing/SigningDocuments';
import { StartScreen } from './screens/start/StartScreen';
import { StatusScreen } from './screens/status/StatusScreen';
import { WaitingScreen } from './screens/waiting/WaitingScreen';

function ProcessScreen() {
  const { current } = useSigningNavigation();
  const {
    state: {
      requestId,
      busy,
      settingProgress,
      signatureCertificates,
      signaturePhase,
    },
    commands,
  } = useSigningProcess();
  const activate = useStatusActions(current, commands.back);
  let certificates: CertificateList = { status: 'loading' };
  if (signatureCertificates) {
    certificates = {
      status: 'loaded',
      options: signatureCertificates.map((certificate) => ({
        id: certificate.thumbprint,
        title:
          [
            certificate.person?.last_name,
            certificate.person?.first_name,
            certificate.person?.middle_name,
          ]
            .filter(Boolean)
            .join(' ') || certificate.serial_number,
        organization: certificate.organization?.name ?? '',
        serial: certificate.serial_number,
        expires: certificate.expires_at
          ? new Date(certificate.expires_at).toLocaleDateString('ru-RU')
          : '',
      })),
    };
  }

  switch (current.process) {
    case 'START':
      return <StartScreen />;
    case 'WAITING':
      return <WaitingScreen />;
    case 'STATUS':
      return (
        <StatusScreen
          response={current}
          requestId={requestId}
          activate={(slot) => void activate(slot)}
        />
      );
    case 'SETTING': {
      const progress = new Map<string, SettingProgress>();
      settingStages.forEach((stage) => {
        const result = settingProgress?.[stage];
        if (!result) return;
        const stageProgress: SettingProgress = { state: result.state };
        if (result.state === 'ERROR') {
          stageProgress.onDetails = () => void commands.showSettingError(stage);
        }
        progress.set(stage, stageProgress);
      });
      return (
        <SettingScreen
          response={current}
          busy={busy}
          progress={progress}
          onCheck={() => void commands.checkSetting()}
        />
      );
    }
    case 'CHECK':
      return (
        <CheckScreen
          key={certificates.status}
          response={current}
          busy={busy}
          phase={signaturePhase}
          certificates={certificates}
          onSign={({ id }) => void commands.submitCheck(id)}
        />
      );
    case 'SIGNING':
      return (
        <SigningDocuments
          key={certificates.status}
          response={current}
          busy={busy}
          phase={signaturePhase}
          certificates={certificates}
          onSign={({ id }) => void commands.submitSigning(id)}
          downloadDocument={commands.downloadDocument}
        />
      );
  }
}

function ProcessRoot() {
  const { commands } = useSigningProcess();
  const { back } = useSigningNavigation();
  return (
    <ProcessErrorBoundary
      onError={commands.recoverFromRenderError}
      onRetry={back}
    >
      <ProcessScreen />
    </ProcessErrorBoundary>
  );
}

export default function App({ inquiryId }: { inquiryId: string }) {
  return (
    <ProcessProvider key={inquiryId} inquiryId={inquiryId}>
      <NavigationProvider>
        <ProcessRoot />
      </NavigationProvider>
    </ProcessProvider>
  );
}
