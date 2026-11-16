/* global require */
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone package uses CommonJS. */

const assert = require('node:assert/strict');
const { Blob, Buffer } = require('node:buffer');
const { once } = require('node:events');
const { test } = require('node:test');
const { createApp } = require('./server.cjs');

const { fetch, FormData, Response } = globalThis;
const api = '/proxy/services/corp-digital-id-sign/api/public/v1';
const properties =
  '/proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign';
const common = {
  inquiry_id: 'synthetic-inquiry',
  req_time: '2026-11-16T12:00:00+03:00',
  sc_name: 'urn:front-corp-digital-id-microfront',
  sp_name: 'urn:corp-digital-id',
};
const certificate = {
  type: 'signed',
  serial_number: '01',
  thumbprint: 'mock-thumbprint',
  expires_at: '2035-01-01T00:00:00Z',
  person: {
    first_name: '',
    last_name: '',
    middle_name: '',
    inn: '',
    snils: '',
  },
  organization: { name: '', inn: '', ogrn: '' },
  issuer: { name: '', inn: '', ogrn: '' },
};

function upload(documentFields, signatureNames, certificateText = 'AQID') {
  const body = new FormData();
  body.append(
    'request',
    new Blob(
      [
        JSON.stringify({
          ...common,
          ...documentFields,
          certificates: [certificate],
        }),
      ],
      { type: 'application/json' },
    ),
  );
  for (const name of signatureNames) {
    body.append(
      'signatures',
      new Blob([Uint8Array.of(0, 255, 2)], {
        type: 'application/pkcs7-signature',
      }),
      name,
    );
  }
  body.append(
    'certificates',
    new Blob([certificateText], { type: 'text/plain' }),
    '01.b64',
  );
  return body;
}

async function startServer(t, redirectTask = false) {
  const logs = [];
  const server = createApp({
    redirectTask,
    logger: (line) => logs.push(JSON.parse(line)),
  }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const address = `http://127.0.0.1:${server.address().port}`;
  return {
    address,
    logs,
    get: (path) => fetch(`${address}${path}`),
    post: (path, body, redirect = 'manual') =>
      fetch(`${address}${api}${path}`, {
        method: 'POST',
        redirect,
        body: body instanceof FormData ? body : JSON.stringify(body),
        headers:
          body instanceof FormData
            ? {}
            : { 'Content-Type': 'application/json' },
      }),
  };
}

async function checkScreen(post) {
  const setting = await (await post('/state/start', common)).json();
  assert.equal(setting.process, 'SETTING');
  assert.ok(setting.session);
  assert.deepEqual(
    setting.screen.lists.testing.map(({ name }) => name),
    ['extension', 'program', 'certificate'],
  );
  const check = await (await post('/state/ready', common)).json();
  assert.equal(check.process, 'CHECK');
  assert.match(check.screen.test_document.hash256, /^[a-f0-9]{64}$/);
  assert.match(check.screen.test_document.hash512, /^[a-f0-9]{128}$/);
  return { test_document: check.screen.test_document };
}

test('accepts CHECK and complete SIGNING groups, serves exact multipart/mixed document bytes', async (t) => {
  const { get, post, logs } = await startServer(t);
  const settings = await (await get(`${properties}/settings`)).json();
  assert.ok(settings.pull_time > 0);
  const warning = await (await get(`${properties}/NO_CERT`)).json();
  assert.equal(warning.screen.level, 'WARNING');

  const testDocument = await checkScreen(post);
  const badCheck = await post(
    '/state/check',
    upload(testDocument, ['test.sig'], 'broken Base64'),
  );
  assert.equal(badCheck.status, 400);
  assert.match((await badCheck.json()).error, /certificates/);
  assert.equal(logs.at(-1).valid, false);
  assert.equal(logs.at(-1).body.parts[1].base64, 'AP8C');

  const pending = await post(
    '/state/check',
    upload(testDocument, ['test.sig']),
  );
  assert.equal(pending.status, 303);
  assert.equal(pending.headers.get('location'), null);
  assert.equal(
    pending.headers.get('access-control-expose-headers'),
    'X-Request-Id',
  );
  assert.equal(logs.at(-1).requestId, pending.headers.get('x-request-id'));
  const { task } = await pending.json();
  const otherInquiry = await post('/poll/status', {
    ...common,
    inquiry_id: 'other',
    task,
  });
  assert.equal(otherInquiry.status, 401);
  const next = await (await post('/poll/status', { ...common, task })).json();
  assert.notEqual(next.task, task);
  const group = await (
    await post('/poll/status', { ...common, task: next.task })
  ).json();
  assert.equal(group.process, 'SIGNING');
  const { documents } = group.screen.lists;
  assert.equal(documents.length, 2);

  const pdf = documents[0];
  const download = await post('/document', { ...common, document_id: pdf.id });
  assert.equal(download.status, 200);
  const contentType = download.headers.get('content-type');
  assert.match(contentType, /^multipart\/mixed; boundary=/);
  const parts = await new Response(await download.arrayBuffer(), {
    headers: {
      'Content-Type': contentType.replace(
        'multipart/mixed',
        'multipart/form-data',
      ),
    },
  }).formData();
  assert.deepEqual([...parts.keys()], ['response', 'file']);
  assert.deepEqual(JSON.parse(parts.get('response')), {
    document_id: pdf.id,
    title: pdf.title,
    format: pdf.format,
  });
  assert.match(
    Buffer.from(parts.get('file'), 'base64').toString('ascii'),
    /^%PDF-1\.4/,
  );

  const partial = await post(
    '/state/signing',
    upload({ documents }, ['agreement.sig']),
  );
  assert.equal(partial.status, 400);
  const changed = documents.map((document) => ({
    ...document,
    title: 'changed',
  }));
  const changedGroup = await post(
    '/state/signing',
    upload({ documents: changed }, ['agreement.sig', 'details.sig']),
  );
  assert.equal(changedGroup.status, 400);
  assert.equal(logs.at(-1).valid, false);
  const signed = await post(
    '/state/signing',
    upload({ documents }, ['details.sig', 'agreement.sig']),
  );
  assert.equal(signed.status, 200);
  const lastGroup = await signed.json();
  assert.equal(lastGroup.process, 'SIGNING');
  assert.notEqual(lastGroup.token, group.token);
  assert.equal(lastGroup.screen.lists.documents.length, 1);
  const result = await post(
    '/state/signing',
    upload(lastGroup.screen.lists, ['receipt.sig']),
  );
  assert.equal(result.status, 200);
  const status = await result.json();
  assert.equal(status.process, 'STATUS');
  assert.equal(status.screen.level, 'SUCCESS');
  assert.equal(logs.at(-1).valid, true);
});

test('redirected CHECK follows Location with GET and still returns task', async (t) => {
  const { post, logs } = await startServer(t, true);
  const testDocument = await checkScreen(post);
  const response = await post(
    '/state/check',
    upload(testDocument, ['test.sig']),
    'follow',
  );
  assert.equal(response.redirected, true);
  assert.equal(response.status, 200);
  assert.ok((await response.json()).task);
  assert.deepEqual(
    logs.slice(-2).map(({ method, status }) => [method, status]),
    [
      ['POST', 303],
      ['GET', 200],
    ],
  );
});

test('rejects JSON schemas, missing multipart boundary and unknown routes with logged outcomes', async (t) => {
  const { address, post, get, logs } = await startServer(t);
  const invalid = await post('/state/start', { ...common, req_time: 'today' });
  assert.equal(invalid.status, 400);
  assert.deepEqual((await invalid.json()).issues[0].path, ['req_time']);
  assert.equal(logs.at(-1).body.req_time, 'today');
  assert.equal(logs.at(-1).valid, false);
  const badMultipart = await post('/state/check', common);
  assert.equal(badMultipart.status, 415);
  assert.equal(logs.at(-1).valid, false);
  const missingBoundary = await fetch(`${address}${api}/state/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: 'invalid multipart',
  });
  assert.equal(missingBoundary.status, 400);
  assert.match((await missingBoundary.json()).error, /boundary/);
  assert.equal(logs.at(-1).body, 'invalid multipart');
  const unknown = await get('/unknown');
  assert.equal(unknown.status, 404);
  assert.equal(logs.at(-1).body, null);
  assert.equal(logs.at(-1).valid, false);
});
