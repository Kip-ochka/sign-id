import express from 'express';
import { env } from 'node:process';
import {
  config,
  document,
  errorScreen,
  process,
  settings,
} from './mock-data.mjs';

const app = express();
const api = '/proxy/services/corp-digital-id-sign/api/public/v1';
const dict =
  '/proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign';

app.use(express.json());
app.use((_request, response, next) => {
  response.set('X-Request-Id', 'mock-request-id');
  next();
});

app.get(`${dict}/settings`, (_request, response) => response.json(settings));
app.get(`${dict}/:key`, (_request, response) => response.json(errorScreen));

// Тело multipart check/signing не разбираем: ответ зависит только от config.
Object.entries(config.state).forEach(([event, key]) => {
  app.post(`${api}/state/${event}`, (_request, response) => {
    response.status(config.http[event]).json(process[key]);
  });
});

app.post(`${api}/poll/status`, (_request, response) => {
  response.status(config.http.poll).json(process[config.poll]);
});

app.post(`${api}/document`, (request, response) => {
  const boundary = 'mock-document-boundary';
  const metadata = {
    document_id: request.body.document_id,
    title: document.title,
    format: document.format,
  };
  response
    .status(config.http.document)
    .type(`multipart/mixed; boundary=${boundary}`)
    .send(
      [
        `--${boundary}`,
        'Content-Disposition: form-data; name="response"',
        'Content-Type: application/json',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"',
        'Content-Type: text/plain',
        '',
        document.base64,
        `--${boundary}--`,
        '',
      ].join('\r\n'),
    );
});

const port = Number(env.MOCK_PORT || 3001);
app.listen(port, '127.0.0.1', () => {
  globalThis.console.log(`Mock API: http://127.0.0.1:${port}`);
});
