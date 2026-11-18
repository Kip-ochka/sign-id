import type { SigningDocument } from '../../shared/api';
import { Loading } from '../../shared/ui/Loading';
import styles from '../../shared/ui/Screen.module.css';

export function DocumentList({
  documents,
  blocked,
  pendingDocumentId,
  onOpenDocument,
}: {
  documents: SigningDocument[];
  blocked: boolean;
  pendingDocumentId?: string;
  onOpenDocument?: (id: string) => void;
}) {
  return (
    <section className={styles.section} aria-labelledby="documents-title">
      <h2 id="documents-title">Документы</h2>
      {documents.length === 0 && <p>Нет документов для подписания.</p>}
      <ul className={styles.list}>
        {documents.map(({ id, title: documentTitle, format }) => (
          <li key={id} className={styles.row}>
            <div>
              <strong>{documentTitle}</strong>
              <div className={styles.detail}>{format}</div>
            </div>
            <button
              type="button"
              className={styles.secondary}
              disabled={
                !onOpenDocument || (blocked && pendingDocumentId !== id)
              }
              aria-disabled={pendingDocumentId === id || undefined}
              aria-label={'Открыть документ «' + documentTitle + '»'}
              onClick={(event) => {
                if (blocked) {
                  return;
                }
                event.currentTarget.focus();
                onOpenDocument?.(id);
              }}
            >
              Открыть документ
            </button>
            {pendingDocumentId === id && <Loading>Загружаем документ</Loading>}
          </li>
        ))}
      </ul>
    </section>
  );
}
