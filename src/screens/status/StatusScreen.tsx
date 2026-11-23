import { useStatusActions } from '../../process/status';
import { useSigningNavigation, useSigningProcess } from '../../widgets/signing-process';
import { StatusView } from '../../widgets/process-status';

export function StatusScreen() {
    const { current } = useSigningNavigation();
    const { state, commands } = useSigningProcess();
    const activate = useStatusActions(current, commands.back);
    if (current.process !== 'STATUS') {
        return null;
    }
    return (
        <StatusView
            response={current}
            requestId={state.requestId}
            activate={slot => {
                activate(slot);
            }}
        />
    );
}
