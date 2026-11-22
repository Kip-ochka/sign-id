import { useState } from 'react';
import { readInquiryId } from './shared/readInquiryId';
import { DigitalIDSignPropsProvider } from './shared/config/digital-id-sign';
import type { DigitalIDSignProps } from './shared/config/digital-id-sign';
import {
  NavigationProvider,
  ProcessProvider,
  useSigningNavigation,
  useSigningProcess,
} from './widgets/signing-process';
import { ProcessErrorBoundary } from './app/ProcessErrorBoundary';
import { CheckScreen } from './screens/check';
import { SettingScreen } from './screens/setting';
import { SigningScreen } from './screens/signing';
import { StartScreen } from './screens/start';
import { StatusScreen } from './screens/status';
import { WaitingScreen } from './screens/waiting';

export type { DigitalIDSignProps };

function ProcessScreen() {
  const { current } = useSigningNavigation();
  switch (current.process) {
    case 'START':
      return <StartScreen />;
    case 'WAITING':
      return <WaitingScreen />;
    case 'STATUS':
      return <StatusScreen />;
    case 'SETTING':
      return <SettingScreen />;
    case 'CHECK':
      return <CheckScreen />;
    case 'SIGNING':
      return <SigningScreen />;
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

export default function DigitalIDSign(props: DigitalIDSignProps) {
  const [inquiryId] = useState(() => readInquiryId(window.location.search));

  return (
    <DigitalIDSignPropsProvider value={props}>
      <ProcessProvider key={inquiryId} inquiryId={inquiryId}>
        <NavigationProvider>
          <ProcessRoot />
        </NavigationProvider>
      </ProcessProvider>
    </DigitalIDSignPropsProvider>
  );
}
