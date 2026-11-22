import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type DigitalIDSignProps = Record<string, never>;

const DigitalIDSignPropsContext = createContext<DigitalIDSignProps | undefined>(undefined);

export function DigitalIDSignPropsProvider({ value, children }: { value: DigitalIDSignProps; children: ReactNode }) {
    return <DigitalIDSignPropsContext.Provider value={value}>{children}</DigitalIDSignPropsContext.Provider>;
}

export function useDigitalIDSignProps() {
    const props = useContext(DigitalIDSignPropsContext);
    if (props === undefined) {
        throw new Error('Пропсы DigitalIDSign доступны только внутри DigitalIDSignPropsProvider');
    }
    return props;
}
