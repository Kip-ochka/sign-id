import { useEffect, useRef, useState } from 'react';
import Button from '@sber-site/malachite-kit/esm/components/Button';
import { Link } from '@sber-site/malachite-kit';
export type DocumentPreview = {
  title: string;
  url: string;
  filename: string;
  kind?: 'image' | 'pdf';
};

// TODO: подключить готовый дизайн просмотра документов; сейчас это функциональная заглушка.
export function PreviewDialog({
  file,
  close,
}: {
  file: DocumentPreview;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const download = useRef<HTMLDivElement>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const pdfUnavailable = file.kind === 'pdf' && !navigator.pdfViewerEnabled;
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, []);
  useEffect(() => {
    if (!file.kind) {
      download.current?.querySelector('a')?.click();
    }
  }, [file.kind]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="preview-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2 id="preview-title">{file.title}</h2>
      <div>
        <Button type="button" theme="primary" size="large" onClick={close}>
          {file.kind ? 'Закрыть просмотр' : 'Закрыть'}
        </Button>
        <div ref={download}>
          <Link theme="secondary" href={file.url} download={file.filename}>
            Скачать документ
          </Link>
        </div>
      </div>
      {(renderFailed || pdfUnavailable) && (
        <p role="status">Просмотр недоступен. Скачайте документ.</p>
      )}
      {!renderFailed && file.kind === 'image' && (
        <img
          src={file.url}
          alt={file.title}
          onError={() => setRenderFailed(true)}
        />
      )}
      {!renderFailed && !pdfUnavailable && file.kind === 'pdf' && (
        <iframe
          src={file.url}
          title={file.title}
          onError={() => setRenderFailed(true)}
        />
      )}
    </dialog>
  );
}
