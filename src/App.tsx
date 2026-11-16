import {
  NavigationProvider,
  useSigningNavigation,
} from './process/NavigationContext';
import { ProcessProvider, useSigningProcess } from './process/ProcessContext';
import { ProcessErrorBoundary } from './process/ProcessErrorBoundary';
import { useStatusActions } from './process/useStatusActions';
import { CheckScreen } from './screens/check/CheckScreen';
import { SettingScreen } from './screens/setting/SettingScreen';
import { SigningScreen } from './screens/signing/SigningScreen';
import { StartScreen } from './screens/start/StartScreen';
import { StatusScreen } from './screens/status/StatusScreen';
import { WaitingScreen } from './screens/waiting/WaitingScreen';

const navigate = (url: string) => window.location.assign(url);

function ProcessScreen() {
  const { current } = useSigningNavigation();
  const {
    state: { requestId, busy },
    commands,
  } = useSigningProcess();
  const activate = useStatusActions(current, commands.back, navigate);

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
    case 'SETTING':
      return <SettingScreen response={current} busy={busy} />;
    case 'CHECK':
      return (
        <CheckScreen
          response={current}
          busy={busy}
          certificates={{ status: 'unavailable' }}
        />
      );
    case 'SIGNING':
      return (
        <SigningScreen
          response={current}
          busy={busy}
          certificates={{ status: 'unavailable' }}
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
