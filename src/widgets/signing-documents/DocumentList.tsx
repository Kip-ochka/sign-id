import type { SigningDocument } from '../../shared/api';
import { Loading } from '../../shared/ui/Loading';
import { DocumentLink } from '../../shared/ui/DocumentLink';
import * as css from '../../shared/ui/Screen.css';
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
  useStyles(css);
  return (
    <section className="section" aria-labelledby="documents-title">
      <h2 id="documents-title">Документы</h2>
      {documents.length === 0 && <p>Нет документов для подписания.</p>}
      <ul className="list">
        {documents.map(({ id, title, format }) => {
          const normalized = format.toUpperCase().replace(/^\./, '');
          let kind: 'DOC' | 'PDF' | 'OTHER' = 'OTHER';
          if (normalized === 'PDF') {
            kind = 'PDF';
          }
          if (normalized === 'DOC' || normalized === 'DOCX') {
            kind = 'DOC';
          }
          return (
            <li key={id}>
              <DocumentLink
                format={kind}
                title={title}
                disabled={
                  !onOpenDocument || (blocked && pendingDocumentId !== id)
                }
                pending={pendingDocumentId === id}
                onClick={() => {
                  if (!blocked) {
                    onOpenDocument?.(id);
                  }
                }}
              />
              {pendingDocumentId === id && (
                <Loading>Загружаем документ</Loading>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
