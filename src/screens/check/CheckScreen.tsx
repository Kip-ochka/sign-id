import type { CheckScreen as CheckResponse, Consent } from '../../shared/api';
import {
  CertificatePicker,
  useSelectedCertificate,
} from '../shared/CertificatePicker';
import type { SignatureControls } from '../shared/CertificatePicker';
import { httpUrl } from '../shared/httpUrl';
import { Loading } from '../shared/Loading';
import { ScreenCard } from '../shared/ScreenCard';
import { WorkActions } from '../shared/WorkActions';
function ConsentText({ consent }: { consent: Consent }) {
  const url = httpUrl(consent.url);
  if (!url || !consent.hypertext) return <p>{consent.text}</p>;
  const start = consent.text.indexOf(consent.hypertext);
  const link = (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {consent.hypertext}
    </a>
  );
  return start < 0 ? (
    <p>
      {consent.text} {link}
    </p>
  ) : (
    <p>
      {consent.text.slice(0, start)}
      {link}
      {consent.text.slice(start + consent.hypertext.length)}
    </p>
  );
}

export function CheckScreen({
  response,
  certificates,
  busy,
  onSign,
}: SignatureControls & {
  response: CheckResponse;
}) {
  const { selected, selectCertificate } = useSelectedCertificate(certificates);
  const { title, message, buttons, consent } = response.screen;
  const blocked = busy || certificates.status === 'loading';
  return (
    <ScreenCard title={title} message={message}>
      <CertificatePicker
        certificates={certificates}
        selected={selected}
        onSelect={selectCertificate}
        busy={blocked}
      />
      <ConsentText consent={consent} />
      {busy && <Loading>Выполняем тестовую подпись</Loading>}
      <WorkActions
        buttons={buttons}
        busy={blocked}
        onAction={selected && onSign ? () => onSign(selected) : undefined}
      />
    </ScreenCard>
  );
}
