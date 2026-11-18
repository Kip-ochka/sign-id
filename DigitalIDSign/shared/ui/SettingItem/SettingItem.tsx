import { SettingItemPropsWithStatus } from './types';
import { WaitStatus } from './WaitStatus';
import { SuccessStatus } from './SuccessStatus';
import { ErrorStatus } from './ErrorStatus';

export const SettingItem = ({ status, ...rest }: SettingItemPropsWithStatus) => {
    const settingType = {
        WAIT: <WaitStatus {...rest} />,
        SUCCESS: <SuccessStatus {...rest} />,
        ERROR: <ErrorStatus {...rest} />,
    };

    return settingType[status];
};
