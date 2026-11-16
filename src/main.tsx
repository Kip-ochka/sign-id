import { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { readInquiryId } from './shared/readInquiryId';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Элемент #root не найден');
}

ReactDOM.render(
  <StrictMode>
    <App inquiryId={readInquiryId(window.location.search)} />
  </StrictMode>,
  root,
);
