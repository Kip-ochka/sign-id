import { ReactNode, createContext, useContext } from 'react';

import { DigitalIDSignProps } from '../../types';

interface AppParamsProviderProps {
    children: ReactNode;
    params: DigitalIDSignProps;
}

const AppParamsContext = createContext<DigitalIDSignProps | undefined>(undefined);

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in root
export const AppParamsProvider = ({ children, params }: AppParamsProviderProps) => {
    return <AppParamsContext.Provider value={params}>{children}</AppParamsContext.Provider>;
};

export const useAppParams = () => {
    const context = useContext(AppParamsContext);
    if (context === undefined) {
        throw new Error('useAppParams must be used within a AppParamsProvider');
    }

    return context;
};
