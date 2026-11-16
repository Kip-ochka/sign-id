import { useLayoutEffect, useRef, useState } from 'react';

import type { SigningScreen as SigningResponse } from '../../shared/api';
import type { SignatureControls } from '../shared/CertificatePicker';
import { createDocumentFile, documentUrl } from './documentFile';
import type { DocumentPreview } from './PreviewDialog';
import { SigningScreen } from './SigningScreen';
import type { SigningPhase } from './SigningScreen';

type DownloadDocument = (
  id: string,
) =>
  Promise<{ title: string; format: string; binary: string } | void> | undefined;

export function SigningDocuments({
  response,
  downloadDocument,
  ...controls
}: SignatureControls & {
  response: SigningResponse;
  phase?: SigningPhase;
  downloadDocument: DownloadDocument;
}) {
  const scope = useRef<{ pending?: string }>();
  const [pending, setPending] = useState<{
    response: SigningResponse;
    id: string;
  }>();
  const [opened, setOpened] = useState<{
    response: SigningResponse;
    preview: DocumentPreview;
  }>();
  const preview = opened?.response === response ? opened.preview : undefined;

  useLayoutEffect(() => {
    scope.current = {};
    return () => {
      scope.current = undefined;
    };
  }, [response]);

  useLayoutEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function openDocument(id: string) {
    const current = scope.current;
    if (!current || current.pending !== undefined) return;
    current.pending = id;
    setPending({ response, id });
    setOpened(undefined);
    try {
      const document = await downloadDocument(id);
      if (!document || scope.current !== current) return;
      const { file, kind } = createDocumentFile(document);
      setOpened({
        response,
        preview: {
          title: document.title,
          filename: file.name,
          url: documentUrl(file, kind),
          kind,
        },
      });
    } finally {
      if (scope.current === current) {
        current.pending = undefined;
        setPending(undefined);
      }
    }
  }

  return (
    <SigningScreen
      {...controls}
      response={response}
      pendingDocumentId={
        pending?.response === response ? pending.id : undefined
      }
      onOpenDocument={(id) => void openDocument(id)}
      preview={preview}
      closePreview={() => setOpened(undefined)}
    />
  );
}
