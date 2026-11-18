import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { text } from 'node:stream/consumers';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';

const browser = process.argv[2];
assert(browser, 'Pass the path to a Chromium browser executable');

const api = '/proxy/services/corp-digital-id-sign/api/public/v1';
const vite = await createViteServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
const page = `<!doctype html><meta charset="utf-8"><pre id="result">pending</pre>
<script type="module">
  import { httpClient, parseProcessResult, pollStatus, state } from '/src/shared/api/index.ts';
  const result = document.querySelector('#result');
  const body = {
    inquiry_id: 'synthetic-inquiry',
    req_time: '2026-01-01T12:00:00Z',
    sc_name: 'urn:front-corp-digital-id-microfront',
    sp_name: 'urn:corp-digital-id',
  };
  try {
    const legacy = await httpClient.post('${api}/state/start', body).catch(error => ({
      status: error.response?.status,
      data: error.response?.data,
    }));
    const initial = await state('start', body);
    const task = parseProcessResult(initial.data);
    if (!task.success || task.data.kind !== 'task') throw Error('Expected task');
    const polled = await pollStatus({ ...body, ...task.data.response }, undefined, null);
    const redirected = await state('ready', body, undefined, 'synthetic-session');
    result.textContent = JSON.stringify({
      legacy,
      initial: { status: initial.status, task: task.data.response.task },
      poll: { status: polled.status, task: polled.data.task },
      redirected: { status: redirected.status, data: redirected.data },
    });
  } catch (error) {
    result.textContent = String(error);
  }
</script>`;

const requests = [];
const server = createServer(async (request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end(page);
    return;
  }
  if (!request.url?.startsWith(api)) {
    vite.middlewares(request, response);
    return;
  }

  const content = await text(request);
  const body = content ? JSON.parse(content) : undefined;
  requests.push({
    method: request.method,
    path: request.url,
    body,
    session: request.headers['session-id'],
  });
  const headers = { 'Content-Type': 'application/json' };
  if (request.url === `${api}/state/start`) {
    response.writeHead(303, headers).end('{"task":"synthetic-task"}');
  } else if (request.url === `${api}/state/ready`) {
    response
      .writeHead(303, { ...headers, Location: `${api}/redirect-target` })
      .end('{"task":"hidden-by-redirect"}');
  } else if (request.url === `${api}/poll/status`) {
    response.writeHead(200, headers).end('{"task":"synthetic-next-task"}');
  } else {
    response.writeHead(200, headers).end('{"redirected":true}');
  }
});

const profileRoot = resolve(tmpdir());
const profile = await mkdtemp(join(profileRoot, 'signing-303-'));
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { stdout } = await promisify(execFile)(
    browser,
    [
      '--headless',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-extensions',
      '--no-first-run',
      '--user-data-dir=' + profile,
      '--dump-dom',
      '--virtual-time-budget=10000',
      `http://127.0.0.1:${server.address().port}/`,
    ],
    { timeout: 30000 },
  );
  const result = stdout.match(/<pre id="result">([^<]*)<\/pre>/)?.[1];
  assert(result && result !== 'pending', stdout);
  assert.deepEqual(JSON.parse(result), {
    legacy: { status: 303, data: { task: 'synthetic-task' } },
    initial: { status: 303, task: 'synthetic-task' },
    poll: { status: 200, task: 'synthetic-next-task' },
    redirected: { status: 200, data: { redirected: true } },
  });
  assert.equal(requests[2].body.task, 'synthetic-task');
  assert.deepEqual(
    requests.slice(1).map(({ session }) => session),
    [undefined, undefined, 'synthetic-session', 'synthetic-session'],
  );
  assert.deepEqual(
    requests.map(({ method, path }) => [method, path.slice(api.length)]),
    [
      ['POST', '/state/start'],
      ['POST', '/state/start'],
      ['POST', '/poll/status'],
      ['POST', '/state/ready'],
      ['GET', '/redirect-target'],
    ],
  );
  process.stdout.write(`${result}\n`);
} finally {
  await vite.close();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(dirname(resolve(profile)), profileRoot);
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
