import type { ReactElement } from 'react';

import type { DigitalIDSignProps } from './types';
import { AppParamsProvider } from './app/app-params-context';
import { QueryClientWrapper } from './app/query/query-client-wrapper';
import { Start } from './pages/Start';
import { Setting } from './pages/Setting';
import { Check } from './pages/Check';
import { Signing } from './pages/Signing';
import { Status } from './pages/Status';

type Status = 'START' | 'SETTING' | 'CEHCK' | 'SIGNING' | 'STATUS';

const statuses: Partial<Record<Status, ReactElement>> = {
    START: <Start />,
    SETTING: <Setting />,
    CEHCK: <Check />,
    SIGNING: <Signing />,
    STATUS: <Status />,
};

const DigitalIDSign = (props: DigitalIDSignProps) => {
    return (
        <AppParamsProvider params={props}>
            <QueryClientWrapper>{statuses['STATUS']}</QueryClientWrapper>
        </AppParamsProvider>
    );
};

export default DigitalIDSign;
