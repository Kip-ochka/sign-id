import { createServer } from 'node:http';
import { buffer } from 'node:stream/consumers';
import type { IncomingHttpHeaders } from 'node:http';
import { afterAll, beforeAll, beforeEach, expect, test } from '@jest/globals';
import { AxiosHeaders } from 'axios';

import {
  getDocument,
  getSettings,
  httpClient,
  parseProcessResult,
  pollStatus,
  state,
} from '..';
import {
  createCertificateFiles,
  createSigningSignatures,
} from '../helpers/files';
import type { Certificate } from '../types';
import {
  checkProcess,
  documentBase64,
  documentMetadata,
  documentMultipart,
  settingProcess,
  settings,
  signingProcess,
  stateBody,
  statusProcess,
  task,
} from './fixtures';

const api = '/proxy/services/corp-digital-id-sign/api/public/v1';
const settingsApi =
  '/proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign';
const screen = { process: statusProcess.process, screen: statusProcess.screen };
const jsonResponses = new Map<string, object>([
  [`${settingsApi}/settings`, settings],
  [`${settingsApi}/error`, screen],
  [`${api}/poll/status`, task],
  [`${api}/state/signing`, task],
]);

const received: {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
}[] = [];
const server = createServer(async (request, response) => {
  const body = await buffer(request);
  received.push({
    method: request.method,
    url: request.url,
    headers: request.headers,
    body,
  });

  if (request.url === `${api}/document`) {
    const { body, contentType } = documentMultipart({ quotedBoundary: true });
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(Buffer.from(body));
    return;
  }

  const payload = jsonResponses.get(request.url ?? '') ?? statusProcess;
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
});

const originalBaseURL = httpClient.defaults.baseURL;
const originalProxy = httpClient.defaults.proxy;

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Локальный сервер не получил TCP-порт');
  }
  httpClient.defaults.baseURL = `http://127.0.0.1:${address.port}`;
  httpClient.defaults.proxy = false;
});

beforeEach(() => {
  received.length = 0;
});

afterAll(async () => {
  httpClient.defaults.baseURL = originalBaseURL;
  httpClient.defaults.proxy = originalProxy;
  if (server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test.each([
  ['settings', settings],
  ['error', screen],
] as const)('getSettings запрашивает ключ %s', async (key, data) => {
  await expect(getSettings(key)).resolves.toMatchObject({ status: 200, data });
  expect(received).toMatchObject([
    { method: 'GET', url: `${settingsApi}/${key}` },
  ]);
  expect(received[0].body).toHaveLength(0);
  expect(received[0].headers).not.toHaveProperty('session-id');
});

test('сброшенная сессия исключает Session-id из HTTP-запроса', async () => {
  await state('start', stateBody, undefined, null);
  expect(received[0].headers).not.toHaveProperty('session-id');
});

test.each([undefined, null, ''])(
  'сессия %s исключает Session-id во всех API-запросах',
  async (session) => {
    const files = { signatures: [], certificates: [] };
    await getSettings('settings', undefined, session);
    await state('start', stateBody, undefined, session);
    await state('ready', stateBody, undefined, session);
    await pollStatus({ ...stateBody, task: task.task }, undefined, session);
    await getDocument(
      { ...stateBody, document_id: documentMetadata.document_id },
      undefined,
      session,
    );
    await state('check', undefined, files, undefined, session);
    await state('signing', undefined, files, undefined, session);
    expect(received).toHaveLength(7);
    received.forEach((request) => {
      expect(request.headers).not.toHaveProperty('session-id');
    });
  },
);

test.each([
  ['start', `${api}/state/start`, stateBody, statusProcess],
  ['ready', `${api}/state/ready`, stateBody, statusProcess],
  ['poll', `${api}/poll/status`, { ...stateBody, task: task.task }, task],
] as const)(
  '%s отправляет JSON и возвращает AxiosResponse',
  async (operation, url, body, data) => {
    const response =
      operation === 'poll'
        ? await pollStatus(body)
        : await state(operation, body);
    expect(response).toMatchObject({ status: 200, data });
    expect(received).toMatchObject([{ method: 'POST', url }]);
    expect(received[0].headers['content-type']).toMatch(/^application\/json\b/);
    expect(JSON.parse(received[0].body.toString('utf8'))).toEqual(body);
  },
);

test.each([settingProcess, signingProcess])(
  'state и pollStatus сохраняют поля $process после валидации',
  async (data) => {
    const routes = [`${api}/state/start`, `${api}/poll/status`];
    const originalResponses = routes.map((route) => jsonResponses.get(route));
    routes.forEach((route) => jsonResponses.set(route, data));

    try {
      const responses = await Promise.all([
        state('start', stateBody),
        pollStatus({ ...stateBody, task: task.task }),
      ]);
      responses.forEach((response) => {
        expect(parseProcessResult(response.data)).toEqual({
          success: true,
          data: { kind: 'process', response: data },
        });
      });
    } finally {
      routes.forEach((route, index) => {
        const original = originalResponses[index];
        if (original) {
          jsonResponses.set(route, original);
        } else {
          jsonResponses.delete(route);
        }
      });
    }
  },
);

test('getDocument отправляет JSON и возвращает разобранный документ', async () => {
  const body = { ...stateBody, document_id: documentMetadata.document_id };
  await expect(
    getDocument(body, undefined, settingProcess.session, signingProcess.token),
  ).resolves.toEqual({
    ...documentMetadata,
    base64: documentBase64,
  });
  expect(received).toMatchObject([{ method: 'POST', url: `${api}/document` }]);
  expect(received[0].headers['session-id']).toBe(settingProcess.session);
  expect(received[0].headers['x-integrity-token']).toBe(signingProcess.token);
  expect(received[0].headers['content-type']).toMatch(/^application\/json\b/);
  expect(JSON.parse(received[0].body.toString('utf8'))).toEqual(body);
});

test('getDocument запрашивает ответ как arraybuffer', async () => {
  const originalAdapter = httpClient.defaults.adapter;
  const { body, contentType } = documentMultipart();
  httpClient.defaults.adapter = async (config) => {
    expect(config.responseType).toBe('arraybuffer');
    return {
      config,
      data: body,
      headers: new AxiosHeaders({ 'content-type': contentType }),
      status: 200,
      statusText: 'OK',
    };
  };

  try {
    await getDocument({
      ...stateBody,
      document_id: documentMetadata.document_id,
    });
  } finally {
    httpClient.defaults.adapter = originalAdapter;
  }
});

const organization = { name: 'Пример', inn: '1', ogrn: '2' };
const firstCertificateMetadata = {
  type: 'signed',
  serial_number: 'cert-1',
  thumbprint: 'thumbprint',
  expires_at: stateBody.req_time,
  person: {
    first_name: 'Иван',
    last_name: 'Иванов',
    inn: '1',
    snils: '2',
  },
  organization,
  issuer: organization,
} satisfies Omit<Certificate, 'certificate_base64'>;
const certificateMetadata = [
  firstCertificateMetadata,
  {
    type: 'signed',
    serial_number: 'cert-2',
    thumbprint: 'thumbprint-2',
  },
] satisfies Omit<Certificate, 'certificate_base64'>[];
const certificateContents = ['Y2VydDE=', 'Y2VydDI='];
const certificates = [
  {
    ...firstCertificateMetadata,
    person: { ...firstCertificateMetadata.person, middle_name: '' },
  },
  {
    ...certificateMetadata[1],
    expires_at: '',
    person: { inn: '  ' },
    organization: {},
    issuer: { name: '' },
  },
].map((metadata, index) =>
  Object.freeze({
    ...metadata,
    certificate_base64: certificateContents[index],
  }),
);

const { test_document: testDocument } = checkProcess.screen;
const { documents } = signingProcess.screen.lists;

test('check допускает отсутствие метаданных сертификата и JSON-части request', async () => {
  const files = {
    signatures: [{ fileName: 'test', base64: 'AP+A' }],
    certificates: [],
  };
  const request = { ...stateBody, test_document: testDocument };
  await state('check', request, files);
  await state('check', undefined, files);

  const [withRequest, withoutRequest] = await Promise.all(
    received.map(({ body, headers }) =>
      new Response(new Uint8Array(body), {
        headers: { 'Content-Type': headers['content-type'] ?? '' },
      }).formData(),
    ),
  );
  const jsonPart = withRequest.get('request') as File;
  expect(JSON.parse(await jsonPart.text())).toEqual(request);
  expect([...withoutRequest.keys()]).toEqual(['signatures']);
});
test.each([
  {
    event: 'check' as const,
    fields: { test_document: testDocument },
    send: () => {
      const signatures = [{ fileName: 'caller-name', base64: 'AP+A' }];
      return state(
        'check',
        Object.freeze({
          ...stateBody,
          test_document: testDocument,
          certificates,
          signatures,
        }),
        {
          signatures,
          certificates: createCertificateFiles(certificates),
        },
      );
    },
    responseData: statusProcess,
    expectedSignatures: [{ name: 'test.sig', bytes: [0, 255, 128] }],
  },
  {
    event: 'signing' as const,
    fields: { documents },
    send: () => {
      const signatures = createSigningSignatures({
        'doc-1': 'AP+A',
        'doc-2': 'AQID',
      });
      return state(
        'signing',
        Object.freeze({ ...stateBody, documents, certificates, signatures }),
        {
          signatures,
          certificates: createCertificateFiles(certificates),
        },
        undefined,
        settingProcess.session,
        signingProcess.token,
      );
    },
    responseData: task,
    expectedSignatures: [
      { name: 'doc-1.sig', bytes: [0, 255, 128] },
      { name: 'doc-2.sig', bytes: [1, 2, 3] },
    ],
  },
])(
  'state/$event отправляет multipart с JSON и файлами',
  async ({ event, fields, send, responseData, expectedSignatures }) => {
    await expect(send()).resolves.toMatchObject({
      status: 200,
      data: responseData,
    });
    expect(received[0].headers['x-integrity-token']).toBe(
      event === 'signing' ? signingProcess.token : undefined,
    );
    expect(received).toMatchObject([
      { method: 'POST', url: `${api}/state/${event}` },
    ]);
    const { body, headers } = received[0];
    const contentType = headers['content-type'] ?? '';
    expect(contentType).toMatch(/^multipart\/form-data; boundary=\S+/);
    const parts = await new Response(new Uint8Array(body), {
      headers: { 'Content-Type': contentType },
    }).formData();
    expect([...parts.keys()]).toEqual([
      'request',
      ...expectedSignatures.map(() => 'signatures'),
      'certificates',
      'certificates',
    ]);

    const jsonPart = parts.get('request');
    expect(jsonPart).toMatchObject({ type: 'application/json' });
    if (jsonPart === null || typeof jsonPart === 'string') {
      throw new Error('Ожидалась файловая JSON-часть request');
    }
    expect(JSON.parse(await jsonPart.text())).toEqual({
      ...stateBody,
      ...fields,
      certificates: certificateMetadata,
    });

    const signatureFiles = parts.getAll('signatures');
    await Promise.all(
      signatureFiles.map(async (part, index) => {
        const { name, bytes } = expectedSignatures[index];
        expect(part).toMatchObject({
          name,
          type: 'application/pkcs7-signature',
        });
        if (typeof part === 'string') {
          throw new Error('Ожидался файл подписи');
        }
        expect([...new Uint8Array(await part.arrayBuffer())]).toEqual(bytes);
      }),
    );

    const certificateFiles = parts.getAll('certificates');
    await Promise.all(
      certificateFiles.map(async (part, index) => {
        const { serial_number, certificate_base64 } = certificates[index];
        expect(part).toMatchObject({
          name: `${serial_number}.b64`,
          type: 'text/plain',
        });
        if (typeof part === 'string') {
          throw new Error('Ожидался файл сертификата');
        }
        expect(await part.text()).toBe(certificate_base64);
      }),
    );
  },
);
