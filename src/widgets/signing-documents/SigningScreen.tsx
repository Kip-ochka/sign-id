import type { SigningScreen as SigningResponse } from '../../shared/api';
import {
  CertificatePicker,
  useSelectedCertificate,
} from '../../entities/signing';
import type { SignatureControls } from '../../entities/signing';
import Heading from '@sber-site/sbercraft-nova-kit/components/Heading';
import Text from '@sber-site/sbercraft-nova-kit/components/Text';
import { useBreakpoints } from '@sber-site/sbercraft-nova-kit/hooks/useBreakpoints';
import { ContentWrapper } from '../../shared/ui/ContentWrapper';
import Typography from '@sber-site/malachite-kit/esm/components/Typography';
import * as css from './SigningScreen.css';
import { WorkActions } from '../../entities/signing';
import { DocumentList } from './DocumentList';

export type SigningPhase = 'signing' | 'sending';

export function SigningScreen({
  response,
  certificates,
  busy,
  phase,
  onSign,
  onOpenDocument,
  pendingDocumentId,
}: SignatureControls & {
  response: SigningResponse;
  phase?: SigningPhase;
  onOpenDocument?: (id: string) => void;
  pendingDocumentId?: string;
}) {
  useStyles(css);
  const { isDesktop } = useBreakpoints();
  const { selected, selectCertificate } = useSelectedCertificate(certificates);
  const {
    title,
    message,
    buttons,
    step,
    lists: { documents },
  } = response.screen;
  const blocked =
    busy ||
    pendingDocumentId !== undefined ||
    certificates.status === 'loading';
  let sign: (() => void) | undefined;
  if (selected && onSign && documents.length > 0) {
    sign = () => onSign(selected);
  }

  return (
    <ContentWrapper>
      <div className="sign_signing">
        <div className="sign_signing__main">
          {step && (
            <div className="sign_signinig_stepper">
              <Typography.Paragraph>{step}</Typography.Paragraph>
            </div>
          )}
          <Heading
            tag="h1"
            size={isDesktop ? 'h2' : 'h3'}
            className="sign_signing__heading"
          >
            {title}
          </Heading>
          <Text className="sign_signing__subheading">{message}</Text>
          <CertificatePicker
            className="sign_signing__select"
            certificates={certificates}
            selected={selected}
            onSelect={selectCertificate}
            busy={blocked}
          />
          <DocumentList
            documents={documents}
            blocked={blocked}
            pendingDocumentId={pendingDocumentId}
            onOpenDocument={onOpenDocument}
          />
        </div>
        <WorkActions
          buttons={buttons}
          busy={blocked}
          loading={busy || phase !== undefined}
          onAction={sign}
        />
      </div>
    </ContentWrapper>
  );
}
