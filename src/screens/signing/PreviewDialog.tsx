import { useEffect, useRef } from 'react';
import styles from '../shared/Screen.module.css';
import local from './PreviewDialog.module.css';
export type DocumentPreview = {
  title: string;
  url: string;
  filename: string;
  kind: 'image' | 'pdf';
};

export function PreviewDialog({
  file,
  close,
}: {
  file: DocumentPreview;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);

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
          Закрыть просмотр
        </button>
        <a
          className={styles.secondary}
          href={file.url}
          download={file.filename}
        >
          Скачать документ
        </a>
      </div>
      {file.kind === 'image' ? (
        <img src={file.url} alt={file.title} />
      ) : (
        <iframe src={file.url} title={file.title} />
      )}
    </dialog>
  );
}
