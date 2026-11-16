import type { SigningScreen as SigningResponse } from '../../shared/api';
import {
  CertificatePicker,
  useSelectedCertificate,
} from '../shared/CertificatePicker';
import type { SignatureControls } from '../shared/CertificatePicker';
import { Loading } from '../shared/Loading';
import { ScreenCard } from '../shared/ScreenCard';
import { WorkActions } from '../shared/WorkActions';
import { DocumentList } from './DocumentList';
import { PreviewDialog } from './PreviewDialog';
import type { DocumentPreview } from './PreviewDialog';

export function SigningScreen({
  response,
  certificates,
  busy,
  onSign,
  onOpenDocument,
  pendingDocumentId,
  preview,
  closePreview,
}: SignatureControls & {
  response: SigningResponse;
  onOpenDocument?: (id: string) => void;
  pendingDocumentId?: string;
  preview?: DocumentPreview;
  closePreview?: () => void;
}) {
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
  const sign =
    selected && onSign && documents.length > 0
      ? () => onSign(selected)
      : undefined;

  return (
    <ScreenCard title={title} message={message} step={step}>
      <DocumentList
        documents={documents}
        blocked={blocked}
        pendingDocumentId={pendingDocumentId}
        onOpenDocument={onOpenDocument}
      />
      <CertificatePicker
        certificates={certificates}
        selected={selected}
        onSelect={selectCertificate}
        busy={blocked}
      />
      {busy && pendingDocumentId === undefined && (
        <Loading>Выполняем подписание</Loading>
      )}
      <WorkActions buttons={buttons} busy={blocked} onAction={sign} />
      {preview && closePreview && (
        <PreviewDialog file={preview} close={closePreview} />
      )}
    </ScreenCard>
  );
}
