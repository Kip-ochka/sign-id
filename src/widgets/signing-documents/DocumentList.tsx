import type { SigningDocument } from '../../shared/api';
import { DocumentLink } from '../../shared/ui/DocumentLink';

import * as css from './DocumentList.css';
export function DocumentList({
    documents,
    blocked,
    pendingDocumentId,
    onOpenDocument
}: {
    documents: SigningDocument[];
    blocked: boolean;
    pendingDocumentId?: string;
    onOpenDocument?: (id: string) => void;
}) {
    useStyles(css);
    return (
        <div className='sign_signing__document-wrapper' aria-label='Документы'>
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
                    <DocumentLink
                        key={id}
                        format={kind}
                        title={title}
                        disabled={!onOpenDocument || (blocked && pendingDocumentId !== id)}
                        pending={pendingDocumentId === id}
                        onClick={() => {
                            if (!blocked) {
                                onOpenDocument?.(id);
                            }
                        }}
                    />
                );
            })}
        </div>
    );
}
