import { settingStages } from '../../entities/signing';
import { useSigningNavigation, useSigningProcess } from '../../widgets/signing-process';
import { type SettingProgress, Workplace } from '../../widgets/workplace';

export function SettingScreen() {
    const { current } = useSigningNavigation();
    const { state, commands } = useSigningProcess();
    if (current.process !== 'SETTING') {
        return null;
    }
    const progress = new Map<string, SettingProgress>();
    settingStages.forEach(stage => {
        const result = state.settingProgress?.[stage];
        if (!result) {
            return;
        }
        const item: SettingProgress = { state: result.state };
        if (result.state === 'ERROR') {
            item.onDetails = () => {
                commands.showSettingError(stage);
            };
        }
        progress.set(stage, item);
    });
    return (
        <Workplace
            response={current}
            busy={state.busy}
            progress={progress}
            onCheck={() => {
                commands.checkSetting();
            }}
        />
    );
}
