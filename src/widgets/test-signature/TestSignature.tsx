import type { CheckScreen as CheckResponse, Consent } from '../../shared/api';
import {
  CertificatePicker,
  useSelectedCertificate,
} from '../../entities/signing';
import type { SignatureControls } from '../../entities/signing';
import { httpUrl } from '../../shared/lib/httpUrl';
import { Loading } from '../../shared/ui/Loading';
import { ScreenCard } from '../../shared/ui/ScreenCard';
import { WorkActions } from '../../entities/signing';
function ConsentText({ consent }: { consent: Consent }) {
  const url = httpUrl(consent.url);
  if (!url || !consent.hypertext) {
    return <p>{consent.text}</p>;
  }
  const start = consent.text.indexOf(consent.hypertext);
  const link = (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {consent.hypertext}
    </a>
  );
  if (start < 0) {
    return (
      <p>
        {consent.text} {link}
      </p>
    );
  }
  return (
    <p>
      {consent.text.slice(0, start)}
      {link}
      {consent.text.slice(start + consent.hypertext.length)}
    </p>
  );
}

export function TestSignature({
  response,
  certificates,
  busy,
  phase,
  onSign,
}: SignatureControls & {
  response: CheckResponse;
  phase?: 'signing' | 'sending';
}) {
  const { selected, selectCertificate } = useSelectedCertificate(certificates);
  const { title, message, buttons, consent } = response.screen;
  const blocked = busy || certificates.status === 'loading';
  let sign: (() => void) | undefined;
  if (selected && onSign) {
    sign = () => onSign(selected);
  }
  return (
    <ScreenCard title={title} message={message}>
      <CertificatePicker
        certificates={certificates}
        selected={selected}
        onSelect={selectCertificate}
        busy={blocked}
      />
      <ConsentText consent={consent} />
      {phase && (
        <Loading>
          {phase === 'sending'
            ? 'Отправляем тестовую подпись'
            : 'Выполняем тестовую подпись'}
        </Loading>
      )}
      <WorkActions buttons={buttons} busy={blocked} onAction={sign} />
    </ScreenCard>
  );
}
