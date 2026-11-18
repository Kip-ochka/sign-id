import { useEffect, useRef, useState } from 'react';
import styles from '../../shared/ui/Screen.module.css';
import local from './PreviewDialog.module.css';
export type DocumentPreview = {
  title: string;
  url: string;
  filename: string;
  kind?: 'image' | 'pdf';
};

export function PreviewDialog({
  file,
  close,
}: {
  file: DocumentPreview;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const download = useRef<HTMLAnchorElement>(null);
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
      download.current?.click();
    }
  }, [file.kind]);

  return (
    <dialog
      ref={dialog}
      className={local.preview}
      aria-labelledby="preview-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2 id="preview-title">{file.title}</h2>
      <div className={styles.actions + ' ' + local.actions}>
        <button type="button" className={styles.primary} onClick={close}>
          {file.kind ? 'Закрыть просмотр' : 'Закрыть'}
        </button>
        <a
          ref={download}
          className={styles.secondary}
          href={file.url}
          download={file.filename}
        >
          Скачать документ
        </a>
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
