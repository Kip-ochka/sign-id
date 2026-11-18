import DigitalIDSign from './DigitalIDSign';
import DigitalIDSignEditorial from './DigitalIDSignEditorial';
import DigitalIDSignPreferences from '../../../../server/params/DigitalIDSign.json';
import { StyleContext } from '../../LoaderContext';

globalThis.microfront = globalThis.microfront || {};
globalThis.microfront.widgets = globalThis.microfront.widgets || {};
globalThis.microfront.widgets.DigitalIDSign = DigitalIDSign;
globalThis.microfront.widgets.DigitalIDSignEditorial = DigitalIDSignEditorial;
globalThis.microfront.widgets.DigitalIDSignPreferences = DigitalIDSignPreferences;

export default function widget(props) {
    return (
        <StyleContext.Provider
            value={{
                insertCss: () => {},
            }}
        >
            <DigitalIDSign {...props} />
        </StyleContext.Provider>
    );
}
