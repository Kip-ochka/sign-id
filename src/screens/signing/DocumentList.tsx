import type { SigningDocument } from '../../shared/api';
import { Loading } from '../shared/Loading';
import styles from '../shared/Screen.module.css';

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
            {pendingDocumentId === id ? (
              <Loading>Загружаем документ</Loading>
            ) : (
              <button
                type="button"
                className={styles.secondary}
                disabled={blocked || !onOpenDocument}
                aria-label={'Открыть документ «' + documentTitle + '»'}
                onClick={() => onOpenDocument?.(id)}
              >
                Открыть документ
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
