import { useCallback, useState } from 'react';
import { initialState, resetProcess, showScreen, showFallback } from '../../entities/signing';
import type { ProcessState } from '../../entities/signing';
import { sessionStorage } from '../../entities/signing';
import type { RequestOptions } from '../../entities/signing';
import { createSettingCache } from '../../process/setting';
import type { SettingCache } from '../../process/setting';
import { createSettingActions } from '../../process/setting';
import { start as requestStart } from '../../process/start';
import { createDocumentActions } from '../../process/documents';
import { useProcessErrors } from '../../process/status';
import { useSessionExpiry } from './useSessionExpiry';
import { useResponse } from './useResponse';
import { useOperation } from './useOperation';
import { useSignatureActions } from './useSignatureActions';

const defaultSettingCache = createSettingCache(() =>
    typeof window === 'undefined' ? undefined : window.navigator.userAgent,
);

// Композиция фичей; состояние заявки остаётся в React и доступно через Context.
export function useProcess(inquiryId: string, settingCache: SettingCache = defaultSettingCache) {
    const [state, setState] = useState<ProcessState>(() => ({
        ...initialState(inquiryId),
        session: sessionStorage.read(),
    }));
    useSessionExpiry(state, setState);
    const { showError, showSetupError } = useProcessErrors(setState);
    const { applyResponse, openSignatureScreen } = useResponse(inquiryId, settingCache, setState, showSetupError);
    const handleStart = useCallback(
        async (options: RequestOptions) => {
            const reply = await requestStart(options, (settings) =>
                setState((previous) => ({ ...previous, settings })),
            );
            await applyResponse(reply, options);
        },
        [applyResponse],
    );
    const { run, stop } = useOperation(state, setState, handleStart, showError);
    const setting = createSettingActions({
        state,
        setState,
        run,
        applyResponse,
        showSetupError,
        settingCache,
    });
    const signature = useSignatureActions(state, setState, run, applyResponse, showError);
    const documents = createDocumentActions(state, run);
    const start = useCallback(() => {
        if (state.screen.process === 'START') {
            return run(handleStart);
        }
        return undefined;
    }, [handleStart, run, state.screen.process]);

    const restart = useCallback(() => {
        stop();
        setState(resetProcess);
        return run(handleStart);
    }, [handleStart, run, stop]);

    const { backScreen } = state;
    // BACK восстанавливает сохранённый рабочий экран без повторной отправки.
    const back = useCallback(() => {
        if (!backScreen) {
            return restart();
        }
        stop();
        if (backScreen.process === 'CHECK' || backScreen.process === 'SIGNING') {
            return run((options) => openSignatureScreen(backScreen, options));
        }
        setState((previous) => showScreen({ ...previous, busy: false }, backScreen));
        return undefined;
    }, [backScreen, openSignatureScreen, restart, run, stop]);

    const recoverFromRenderError = () => {
        stop();
        setState((previous) => showFallback({ ...previous, busy: false }));
    };

    return {
        state,
        commands: {
            start,
            back,
            ...setting,
            ...signature,
            ...documents,
            recoverFromRenderError,
        },
    };
}
