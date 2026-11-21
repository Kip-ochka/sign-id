import { getCryptoErrorCode } from '../../shared/lib/cryptoErrors';
import { requestReady } from '../../entities/signing';
import type {
  ProcessState,
  SettingStage,
  WorkplaceResult,
} from '../../entities/signing';
import type {
  UpdateProcess,
  RunOperation,
  ApplyResponse,
  ShowSetupError,
} from '../../entities/signing';
import { checkWorkplace } from './checkWorkplace';
import type { SettingCache } from './settingCache';

export function createSettingActions({
  state,
  setState,
  run,
  applyResponse,
  showSetupError,
  settingCache,
  diagnoseWorkplace = false,
}: {
  state: ProcessState;
  setState: UpdateProcess;
  run: RunOperation;
  applyResponse: ApplyResponse;
  showSetupError: ShowSetupError;
  settingCache: SettingCache;
  diagnoseWorkplace?: boolean;
}) {
  const { inquiryId } = state;
  const checkSetting = () => {
    const { screen } = state;
    if (screen.process !== 'SETTING') {
      return undefined;
    }
    return run(async (options) => {
      const { signal } = options;
      setState((previous) => ({
        ...previous,
        settingProgress: undefined,
        workplaceCertificates: undefined,
      }));
      const update = (stage: SettingStage, result: WorkplaceResult) =>
        setState((previous) => ({
          ...previous,
          settingProgress: { ...previous.settingProgress, [stage]: result },
        }));
      let stageStartedAt = 0;
      const result = await checkWorkplace(
        signal,
        (stage, progress) => {
          if (diagnoseWorkplace) {
            if (progress === 'RUNNING') {
              stageStartedAt = performance.now();
            } else {
              console.info('[SETTING]', stage, progress, {
                elapsedMs: Math.round(performance.now() - stageStartedAt),
              });
            }
          }
          update(stage, { state: progress });
        },
        async (stage, error) => {
          const code = getCryptoErrorCode(error);
          if (diagnoseWorkplace) {
            console.warn('[SETTING]', stage, 'ERROR', {
              elapsedMs: Math.round(performance.now() - stageStartedAt),
              code,
              error,
            });
          }
          update(stage, { state: 'ERROR', code });
          if (
            !screen.screen.lists?.testing?.some(({ name }) => name === stage)
          ) {
            await showSetupError(code, options);
          }
        },
      );
      if (!result || signal.aborted) {
        return;
      }

      settingCache.save(inquiryId);
      setState((previous) => ({
        ...previous,
        workplaceCertificates: result.certificates,
      }));
      const reply = await requestReady(options);
      await applyResponse(reply, options);
    });
  };

  const showSettingError = (stage: SettingStage) => {
    const result = state.settingProgress?.[stage];
    if (state.screen.process !== 'SETTING' || result?.state !== 'ERROR') {
      return undefined;
    }
    return run(async (options) => showSetupError(result.code, options));
  };

  return { checkSetting, showSettingError };
}
