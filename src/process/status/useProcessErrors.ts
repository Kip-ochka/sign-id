import { useCallback } from 'react';
import { getCryptoErrorKey } from '../../shared/lib/cryptoErrors';
import { loadErrorScreen } from '../../entities/signing';
import type { RequestOptions } from '../../entities/signing';
import { showScreen } from '../../entities/signing';
import type { UpdateProcess } from '../../entities/signing';

export function useProcessErrors(setState: UpdateProcess) {
    // Загружаем текст ошибки из справочника и показываем ID исходного запроса.
    const showError = useCallback(
        async (key: string | undefined, options: RequestOptions, requestId?: string) => {
            const screen = await loadErrorScreen(key, options);
            if (!options.signal.aborted) {
                setState((previous) => showScreen(previous, { ...screen }, requestId, key));
            }
        },
        [setState],
    );

    const showSetupError = useCallback(
        (code: string, options: RequestOptions) => {
            if (options.signal.aborted) {
                return undefined;
            }
            return showError(getCryptoErrorKey(code, 'setup'), options);
        },
        [showError],
    );

    return { showError, showSetupError };
}
