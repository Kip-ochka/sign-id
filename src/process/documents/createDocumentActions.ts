import { requestDocument } from '../../entities/signing';
import type { ProcessState } from '../../entities/signing';
import type { RunOperation } from '../../entities/signing';

export function createDocumentActions(state: ProcessState, run: RunOperation) {
  const downloadDocument = (documentId: string) => {
    const { screen } = state;
    if (
      screen.process !== 'SIGNING' ||
      !screen.screen.lists.documents.some(({ id }) => id === documentId)
    ) {
      return undefined;
    }
    return run((options) => requestDocument(documentId, options));
  };

  return { downloadDocument };
}
