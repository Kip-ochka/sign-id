import { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import DigitalIDSign from './DigitalIDSign';

const root = document.getElementById('root');

if (!root) {
    throw new Error('Элемент #root не найден');
}

ReactDOM.render(
    <StrictMode>
        <DigitalIDSign />
    </StrictMode>,
    root,
);
