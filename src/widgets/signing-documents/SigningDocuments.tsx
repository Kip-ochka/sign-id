import { useLayoutEffect, useRef, useState } from 'react';

import type { SigningScreen as SigningResponse } from '../../shared/api';
import type { SignatureControls } from '../../entities/signing';
import { openDocumentFile } from './documentFile';
import { type SigningPhase, SigningScreen } from './SigningScreen';

type DownloadDocument = (id: string) => Promise<{ title: string; format: string; binary: string } | void> | undefined;

export function SigningDocuments({
    response,
    downloadDocument,
    ...controls
}: SignatureControls & {
    response: SigningResponse;
    phase?: SigningPhase;
    downloadDocument: DownloadDocument;
}) {
    const scope = useRef<{ pending?: string; url?: string }>();
    const [pending, setPending] = useState<{
        response: SigningResponse;
        id: string;
    }>();
    useLayoutEffect(() => {
        const current: NonNullable<typeof scope.current> = {};
        scope.current = current;
        return () => {
            scope.current = undefined;
            if (current.url) {
                URL.revokeObjectURL(current.url);
            }
        };
    }, [response]);

    async function openDocument(id: string) {
        const current = scope.current;
        if (!current || current.pending !== undefined) {
            return;
        }
        current.pending = id;
        setPending({ response, id });
        try {
            const result = await downloadDocument(id);
            if (!result || scope.current !== current) {
                return;
            }
            const url = openDocumentFile(result);
            if (current.url) {
                URL.revokeObjectURL(current.url);
            }
            current.url = url;
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
            pendingDocumentId={pending?.response === response ? pending.id : undefined}
            onOpenDocument={id => {
                openDocument(id);
            }}
        />
    );
}
