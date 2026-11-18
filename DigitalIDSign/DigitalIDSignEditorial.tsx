// @ts-ignore
import useStyleContext from '@sber-site/microfront-kit/api/hooks/useStyleContext';

import { StyleContext } from '../../LoaderContext';
import DigitalIDSign from './DigitalIDSign';
import type { DigitalIDSignProps } from './types';

const DigitalIDSignEditorial = (props: DigitalIDSignProps) => {
    const styleContext = useStyleContext(document.querySelector('#canvas-iframe'));

    return (
        <StyleContext.Provider value={styleContext}>
            <DigitalIDSign {...props} />
        </StyleContext.Provider>
    );
};

DigitalIDSignEditorial.displayName = 'DigitalIDSignEditorial';

export default DigitalIDSignEditorial;
