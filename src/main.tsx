import { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import App from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Элемент #root не найден');
}

ReactDOM.render(
  <StrictMode>
    <App
      workplaceDiagnosticId={
        import.meta.env.DEV ? 'workplace-diagnostics' : undefined
      }
    />
  </StrictMode>,
  root,
);
