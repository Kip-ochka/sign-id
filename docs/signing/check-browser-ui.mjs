/* global fetch, Response, WebSocket */
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { createServer as createViteServer } from 'vite';

const [browser, output = 'docs/signing/ui-screenshots'] = process.argv.slice(2);
assert(browser, 'Pass the path to Chrome');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'signing-ui-'));
const vite = await createViteServer({
  server: { middlewareMode: true, ws: false },
  optimizeDeps: { exclude: ['crypto-pro-actual-cades-plugin'] },
  plugins: [
    {
      name: 'synthetic-crypto-pro',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'crypto-pro-actual-cades-plugin')
          return '\0synthetic-crypto-pro';
      },
      load(id) {
        if (id !== '\0synthetic-crypto-pro') return;
        return `
        let searches = 0;
        let selectedCertificate;
        let algorithm;
        let hash;
        const inquiry = new URLSearchParams(location.search).get('id');
        export function execute(operation) {
          return operation({ cadesplugin: {
            CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256: 101,
            CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_512: 102,
            CADESCOM_PKCS7_TYPE: 65535,
            CreateObjectAsync: async (name) => {
              switch (name) {
                case 'CAdESCOM.HashedData':
                  return {
                    propset_Algorithm: async (value) => { algorithm = value; },
                    SetHashValue: async (value) => { hash = value; },
                  };
                case 'CAdESCOM.CPSigner':
                  return { propset_Certificate: async (value) => { selectedCertificate = value; } };
                case 'CAdESCOM.CadesSignedData':
                  return { SignHash: async (_data, _signer, profile) => {
                    if (profile !== 65535) throw new Error('Expected PKCS7');
                    if (selectedCertificate === 'SECOND' && algorithm === 102) {
                      if (hash === 'b'.repeat(128)) return 'YWJj';
                      if (hash === 'd'.repeat(128) && inquiry === 'synthetic-signing') return 'ZGVm';
                    }
                    if (inquiry === 'synthetic-signing' && selectedCertificate === 'FIRST' &&
                        algorithm === 101 && hash === 'c'.repeat(64)) return 'Z2hp';
                    throw new Error('Unexpected signer, algorithm or hash');
                  } };
                default:
                  return { CSPVersion: async () => {
                    if (inquiry !== 'synthetic-documents' && inquiry !== 'synthetic-signing') {
                      throw new Error('CSP check was not requested');
                    }
                    return { MajorVersion: 5, MinorVersion: 0, BuildVersion: 1 };
                  } };
              }
            },
          } });
        }
        export async function getUserCertificates() {
          if (inquiry === 'synthetic-check' || inquiry === 'synthetic-signing') {
            return ['FIRST', 'SECOND', 'OUTSIDE_FILTER', 'EXPIRED', 'FUTURE'].map((thumbprint, index) => ({
              subjectName: 'SN=Тестов,G=Иван,O=Организация ' + (index + 1) +
                ',INN=' + (index === 2 ? '000000000000' : '123456789012'),
              issuerName: 'O=Synthetic CA',
              thumbprint,
              validFrom: thumbprint === 'FUTURE' ? '2040-01-01' : '2020-01-01',
              validTo: thumbprint === 'EXPIRED' ? '2021-01-01' : '2050-01-01',
              getCadesProp: async () => String(index + 1),
              getAlgorithm: async () => ({ oid: inquiry === 'synthetic-signing' && thumbprint === 'FIRST'
                ? '1.2.643.7.1.1.1.1' : '1.2.643.7.1.1.1.2' }),
              exportBase64: async () => 'Y2VydA==',
              _cadesCertificate: thumbprint,
            }));
          }
          if (inquiry !== 'synthetic-documents' && ++searches === 1) return [];
          return [{
            subjectName: 'INN=123456789012',
            issuerName: 'O=Synthetic CA',
            thumbprint: 'SYNTHETIC',
            validFrom: '2020-01-01',
            validTo: '2030-01-01',
            getCadesProp: async () => '01',
          }];
        }
      `;
      },
    },
  ],
});
const {
  checkProcess,
  documentMultipart,
  settingProcess,
  settings,
  signingProcess,
} = await vite.ssrLoadModule('/src/shared/api/__tests__/fixtures.ts');
const signingDocuments = [
  { id: 'preview', title: 'Синтетический PDF', format: 'PDF' },
  { id: 'download', title: 'Данные JSON', format: 'JSON' },
  { id: 'broken-image', title: 'Синтетический PNG', format: 'png' },
  { id: 'invalid', title: 'Повреждённый ответ', format: 'pdf' },
  { id: 'expired', title: 'Истекшая сессия', format: 'doc' },
];
const jsonBytes = Buffer.from('{"synthetic":true}\n');
const pngBytes = Buffer.from('89504e470d0a1a0a', 'hex');

function minimalPdf() {
  const content = '0.10 0.28 0.62 rg\n15 15 90 50 re f\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ];
  let body = '%PDF-1.4\n';
  const xref = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  return Buffer.from(
    body +
      `xref\n0 5\n0000000000 65535 f \n${xref.join('')}trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n${body.length}\n%%EOF\n`,
  );
}

const documentRequests = [];
const requests = [];
let checkForm;
const signingForms = [];
const pollRequests = [];
let signingJourney = false;
let restartScenario = false;
let restartStarts = 0;
const signButton = {
  accent: { message: 'Подписать документы', process: 'SIGNING' },
};
const firstGroup = {
  ...signingProcess,
  cryptopro: {
    ...signingProcess.cryptopro,
    filters: { person: { inn: '123456789012' } },
  },
  screen: { ...signingProcess.screen, buttons: signButton },
};
const secondGroup = {
  ...firstGroup,
  cryptopro: {
    ...firstGroup.cryptopro,
    filters: { organization: { name: 'Организация 1' } },
  },
  screen: {
    ...firstGroup.screen,
    title: 'Подписание новой группы',
    lists: {
      documents: [
        {
          ...signingProcess.screen.lists.documents[1],
          id: 'next',
          title: 'Документ новой группы',
        },
      ],
    },
  },
};
const server = createServer((request, response) => {
  if (!request.url?.startsWith('/proxy/')) {
    vite.middlewares(request, response);
    return;
  }
  requests.push(request.url);
  response.setHeader('Content-Type', 'application/json');
  if (request.url.endsWith('/corp-digital-id-sign/settings')) {
    response.end(JSON.stringify(settings));
  } else if (request.url.endsWith('/state/start')) {
    const starts = requests.filter((url) =>
      url.endsWith('/state/start'),
    ).length;
    if (starts === 1) {
      response.statusCode = 303;
      response.end('{"task":"ui-fixture"}');
    } else if (starts === 6) {
      response.end(
        JSON.stringify({
          ...checkProcess,
          cryptopro: {
            ...checkProcess.cryptopro,
            filters: { person: { inn: '123456789012' } },
          },
          screen: {
            ...checkProcess.screen,
            consent: {
              ...checkProcess.screen.consent,
              text: 'Прочитайте условия проверки. Подробнее.',
            },
            buttons: {
              accent: {
                message: 'Выполнить тестовую подпись',
                process: 'CHECK',
              },
            },
          },
        }),
      );
    } else if (restartScenario) {
      response.end(JSON.stringify({ task: 'restart-' + ++restartStarts }));
    } else if (signingJourney) {
      response.end(
        JSON.stringify({
          ...settingProcess,
          cryptopro: firstGroup.cryptopro,
        }),
      );
    } else if (starts >= 7) {
      const documents =
        starts === 7
          ? signingDocuments
          : [{ id: 'new', title: 'Новая группа', format: 'doc' }];
      response.end(
        JSON.stringify({
          ...signingProcess,
          screen: {
            ...signingProcess.screen,
            lists: {
              documents: documents.map((document) => ({
                ...signingProcess.screen.lists.documents[0],
                ...document,
              })),
            },
          },
        }),
      );
    } else {
      response.end(
        JSON.stringify({
          ...settingProcess,
          screen: {
            ...settingProcess.screen,
            lists: {
              testing: [
                {
                  ...settingProcess.screen.lists.testing[0],
                  name: 'synthetic-extra',
                  state: 'SUCCESS',
                },
                ...settingProcess.screen.lists.testing.filter(
                  ({ name }) => name !== 'program' || starts === 4,
                ),
              ],
            },
          },
          cryptopro: { filters: { person: { inn: '123456789012' } } },
        }),
      );
    }
  } else if (request.url.endsWith('/document')) {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', async () => {
      const dto = JSON.parse(Buffer.concat(chunks).toString());
      documentRequests.push(dto);
      const metadata = [
        ...signingDocuments,
        firstGroup.screen.lists.documents[0],
      ].find(({ id }) => id === dto.document_id);
      if (!metadata || metadata.id === 'expired') {
        response.statusCode = 401;
        response.end('{}');
        return;
      }
      const file = {
        preview: minimalPdf().toString('base64'),
        'doc-1': minimalPdf().toString('base64'),
        download: jsonBytes.toString('base64'),
        'broken-image': pngBytes.toString('base64'),
        invalid: 'not;base64',
      }[metadata.id];
      const { body, contentType } = documentMultipart({
        json: JSON.stringify({
          document_id: metadata.id,
          title: metadata.title,
          format: metadata.format,
        }),
        file,
      });
      await setTimeout(200);
      response.setHeader('Content-Type', contentType);
      response.end(Buffer.from(body));
    });
  } else if (
    request.url.endsWith('/corp-digital-id-sign/RESPONSE_DOC_DOWNLOAD_ERROR')
  ) {
    response.end(
      JSON.stringify({
        process: 'STATUS',
        screen: {
          level: 'WARNING',
          title: 'Ошибка получения документа',
          message: 'Вернитесь к списку',
          buttons: { accent: { message: 'Назад', process: 'BACK' } },
        },
      }),
    );
  } else if (request.url.endsWith('/poll/status')) {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      pollRequests.push(body);
      if (restartScenario) {
        response.statusCode = 401;
        response.setHeader('X-Request-Id', body.task);
        response.end('{}');
      } else if (body.task === 'check-complete') {
        response.end(JSON.stringify(firstGroup));
      } else {
        response.setHeader('X-Request-Id', 'ui-fixture-request');
        response.end(
          JSON.stringify({
            process: 'STATUS',
            timer: 0,
            screen: {
              level: 'ERROR',
              title: 'Ошибка проверки',
              message: 'Повторите попытку',
              buttons: { accent: { message: 'Назад', process: 'BACK' } },
            },
          }),
        );
      }
    });
  } else if (request.url.endsWith('/corp-digital-id-sign/RESPONSE_ERROR')) {
    response.setHeader('X-Request-Id', 'dictionary-request');
    response.end(
      JSON.stringify({
        process: 'STATUS',
        screen: {
          level: 'WARNING',
          title: 'Не удалось продолжить',
          message: 'Повторите попытку',
          buttons: { accent: { message: 'Назад', process: 'BACK' } },
        },
      }),
    );
  } else if (request.url.endsWith('/corp-digital-id-sign/NO_CERT')) {
    response.end(
      JSON.stringify({
        process: 'STATUS',
        screen: {
          level: 'WARNING',
          title: 'Нет подходящих сертификатов',
          message: 'Проверьте сертификат',
          buttons: {
            accent: { message: 'Попробовать снова', process: 'BACK' },
          },
        },
      }),
    );
  } else if (request.url.endsWith('/state/check')) {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      checkForm = new Response(Buffer.concat(chunks), {
        headers: { 'Content-Type': request.headers['content-type'] },
      }).formData();
      if (signingJourney) {
        response.writeHead(303).end('{"task":"check-complete"}');
        return;
      }
      response.end(
        JSON.stringify({
          process: 'STATUS',
          screen: {
            level: 'SUCCESS',
            title: 'Тестовая подпись принята',
            message: 'Проверка завершена',
            buttons: { accent: { message: 'Назад', process: 'BACK' } },
          },
        }),
      );
    });
  } else if (request.url.endsWith('/state/signing')) {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', async () => {
      signingForms.push(
        new Response(Buffer.concat(chunks), {
          headers: { 'Content-Type': request.headers['content-type'] },
        }).formData(),
      );
      await setTimeout(200);
      response.end(
        JSON.stringify(
          signingForms.length === 1
            ? secondGroup
            : {
                process: 'STATUS',
                screen: {
                  level: 'SUCCESS',
                  title: 'Документы приняты',
                  message: 'Обработка завершена',
                  buttons: { accent: { message: 'Назад', process: 'BACK' } },
                },
              },
        ),
      );
    });
  } else if (request.url.endsWith('/state/ready')) {
    if (signingJourney) {
      response.end(
        JSON.stringify({
          ...checkProcess,
          cryptopro: firstGroup.cryptopro,
          screen: {
            ...checkProcess.screen,
            buttons: {
              accent: {
                message: 'Выполнить тестовую подпись',
                process: 'CHECK',
              },
            },
          },
        }),
      );
      return;
    }
    response.end(
      JSON.stringify({
        process: 'STATUS',
        screen: {
          level: 'SUCCESS',
          title: 'Рабочее место проверено',
          message: 'Проверка завершена',
          buttons: { accent: { message: 'Назад', process: 'BACK' } },
        },
      }),
    );
  } else {
    response.statusCode = 500;
    response.end('{}');
  }
});

async function until(read) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const result = await read();
    if (result) return result;
    await setTimeout(100);
  }
  throw new Error('Timed out waiting for Chromium or UI');
}

let chrome;
let socket;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  chrome = spawn(
    browser,
    [
      '--headless',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-extensions',
      '--no-first-run',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  const port = await until(async () => {
    try {
      return (
        await readFile(join(profile, 'DevToolsActivePort'), 'utf8')
      ).split('\n')[0];
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EBUSY') throw error;
    }
  });
  const tabs = await (
    await fetch('http://127.0.0.1:' + port + '/json/list')
  ).json();
  socket = new WebSocket(
    tabs.find(({ type }) => type === 'page').webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const { id, result, error } = JSON.parse(data);
    if (!pending.has(id)) return;
    const { resolve, reject } = pending.get(id);
    pending.delete(id);
    if (error) reject(new Error(error.message));
    else resolve(result);
  });

  function command(method, params = {}, sessionId) {
    const id = ++sequence;
    return Promise.race([
      new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      }),
      setTimeout(10000, undefined, { ref: false }).then(() => {
        pending.delete(id);
        throw new Error('Chromium timeout: ' + method);
      }),
    ]);
  }

  async function evaluate(expression) {
    const { result, exceptionDetails } = await command('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails)
      throw new Error(result.description ?? exceptionDetails.text);
    return result.value;
  }

  async function resize(width) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async function key(name, code) {
    for (const type of ['keyDown', 'keyUp']) {
      await command('Input.dispatchKeyEvent', {
        type,
        key: name,
        code: name,
        windowsVirtualKeyCode: code,
        ...(code === 13 && type === 'keyDown'
          ? { text: '\r', unmodifiedText: '\r' }
          : {}),
      });
    }
  }

  async function screenshot(name, fullPage = false) {
    const { cssContentSize } = await command('Page.getLayoutMetrics');
    const clip = fullPage
      ? {
          x: 0,
          y: 0,
          width: cssContentSize.width,
          height: cssContentSize.height,
          scale: 1,
        }
      : undefined;
    const { data } = await command('Page.captureScreenshot', {
      clip,
      captureBeyondViewport: fullPage,
    });
    await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
  }

  async function showCase(scenario) {
    await evaluate(
      '(() => { const select = document.querySelector("#fixture-case"); select.value = ' +
        JSON.stringify(scenario) +
        '; select.dispatchEvent(new Event("change", { bubbles: true })); })()',
    );
    await until(() =>
      evaluate('document.querySelector("main h1")?.textContent'),
    );
  }

  await command('Page.navigate', {
    url: base + '/docs/signing/ui-preview.html',
  });
  await until(() =>
    evaluate('document.querySelector("#fixture-case") !== null'),
  );
  const scenarios = await evaluate(
    '[...document.querySelector("#fixture-case").options].map(option => option.value)',
  );
  await resize(768);
  for (const scenario of scenarios) {
    await showCase(scenario);
    assert.equal(
      await evaluate('document.activeElement?.tagName'),
      'H1',
      scenario,
    );
    await screenshot(
      scenario + '-768',
      scenario === 'signing' || scenario === 'document-loading',
    );
  }

  for (const width of [360, 1280]) {
    await resize(width);
    for (const scenario of scenarios) {
      await showCase(scenario);
      assert.equal(
        await evaluate('document.documentElement.scrollWidth <= innerWidth'),
        true,
        scenario + ' at ' + width,
      );
    }
  }
  await resize(768);

  await showCase('check-multiple');
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    true,
  );
  await key('Tab', 9);
  assert.equal(await evaluate('document.activeElement?.tagName'), 'SELECT');
  assert.equal(
    await evaluate('getComputedStyle(document.activeElement).outlineStyle'),
    'solid',
  );
  await key('ArrowDown', 40);
  assert.equal(
    await evaluate('document.querySelector("main select").value'),
    'first',
  );
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("main select option")[2].textContent.includes("002")',
    ),
    true,
  );
  assert.equal(
    await evaluate('document.querySelector("main a").textContent'),
    'Подробнее',
  );
  await key('Tab', 9);
  assert.equal(await evaluate('document.activeElement?.tagName'), 'A');
  await key('Tab', 9);
  await key('Enter', 13);
  assert.match(
    await evaluate('document.querySelector("output")?.textContent'),
    /001/,
  );
  await showCase('check-single');
  assert.equal(
    await evaluate(
      '!document.querySelector("main select") && !document.querySelector("main button").disabled',
    ),
    true,
  );
  await showCase('check-empty');
  assert.equal(
    await evaluate(
      'Boolean(document.querySelector("[role=alert]")) && document.querySelector("main button").disabled',
    ),
    true,
  );
  await showCase('check-busy');
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    true,
  );

  await showCase('setting-error');
  await evaluate(
    'Array.from(document.querySelectorAll("main button")).find(button => button.textContent.trim() === "Подробнее").click()',
  );
  assert.equal(
    await evaluate('document.querySelector("[data-level]").dataset.level'),
    'ERROR',
  );

  await showCase('signing');
  assert.equal(
    await evaluate('document.querySelectorAll("main li").length'),
    12,
  );
  await showCase('signing-updated');
  assert.equal(
    await evaluate('document.querySelectorAll("main li").length'),
    1,
  );
  assert.match(
    await evaluate('document.querySelector("main").textContent'),
    /Подписание дополнительного документа/,
  );
  await showCase('signing');
  for (const width of [360, 768, 1280]) {
    await resize(width);
    assert.equal(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      true,
      'SIGNING at ' + width,
    );
    if (width !== 768) await screenshot('signing-' + width, true);
    await showCase('error');
    assert.equal(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      true,
      'ERROR at ' + width,
    );
    if (width !== 768) await screenshot('error-' + width);
    await showCase('signing');
  }

  await resize(768);
  await evaluate(
    'document.querySelector("main select").value = "second"; document.querySelector("main select").dispatchEvent(new Event("change", { bubbles: true })); document.querySelector("main li button").focus()',
  );
  await key('Enter', 13);
  await until(() =>
    evaluate('document.querySelector("dialog[open] img")?.naturalWidth > 0'),
  );
  assert.equal(
    await evaluate(
      'document.querySelector("dialog a").hasAttribute("download")',
    ),
    true,
  );
  await screenshot('document-preview-768');
  await key('Escape', 27);
  await until(() =>
    evaluate(
      '!document.querySelector("dialog") && document.activeElement === document.querySelector("main li button") && document.querySelector("main select").value === "second"',
    ),
  );

  await evaluate(
    'localStorage.setItem("digitalid_sign_inq", "legacy-inquiry")',
  );
  await command('Page.navigate', { url: base + '/' });
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Ссылка недействительна"',
    ),
  );
  assert.equal(
    await evaluate('document.querySelectorAll("main button").length'),
    0,
  );
  assert.equal(requests.length, 0);

  const inquiryUrl = base + '/?id=synthetic-inquiry';
  await command('Page.navigate', { url: inquiryUrl });
  await until(() =>
    evaluate('document.querySelector("h1")?.textContent === "Ошибка проверки"'),
  );
  assert.equal(
    await evaluate('document.querySelector("code").textContent'),
    'ui-fixture-request',
  );
  await key('Tab', 9);
  await key('Enter', 13);
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Настройка рабочего места"',
    ),
  );
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    false,
  );
  assert.deepEqual(
    await evaluate(
      '[...document.querySelectorAll("[data-state]")].map(row => row.dataset.state)',
    ),
    ['WAIT', 'WAIT', 'WAIT'],
  );
  await evaluate('document.querySelector("main button").click()');
  await until(() =>
    evaluate('document.querySelector("[data-state=ERROR]") !== null'),
  );
  assert.deepEqual(
    await evaluate(
      'Object.fromEntries([...document.querySelectorAll("main li:has([data-state])")].map(row => [row.querySelector("strong").textContent, row.querySelector("[data-state]").dataset.state]))',
    ),
    {
      'synthetic-extra': 'WAIT',
      Сертификаты: 'ERROR',
      Расширение: 'SUCCESS',
    },
  );
  await evaluate('document.querySelector("main li button").click()');
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Нет подходящих сертификатов"',
    ),
  );
  await evaluate('document.querySelector("main button").click()');
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Настройка рабочего места"',
    ),
  );
  await evaluate(
    '[...document.querySelectorAll("main button")].find(button => button.textContent === "Запустить проверку").click()',
  );
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Рабочее место проверено"',
    ),
  );
  const cache = await evaluate('localStorage.getItem("digital_id_sign")');
  assert.equal(typeof cache, 'string');
  const cacheEntry = JSON.parse(cache);
  const { checked_at: checkedAt } = cacheEntry;
  assert.ok(Number.isSafeInteger(checkedAt));
  assert.deepEqual(cacheEntry, {
    version: 2,
    inquiry_id: 'synthetic-inquiry',
    device: await evaluate('navigator.userAgent'),
    checked_at: checkedAt,
    stages: ['extension', 'certificate'],
  });

  await command('Page.navigate', { url: inquiryUrl + '&entry=cache-hit' });
  await until(() =>
    evaluate(
      'location.search.endsWith("&entry=cache-hit") && document.querySelector("h1")?.textContent === "Рабочее место проверено"',
    ),
  );
  assert.equal(
    await evaluate('localStorage.getItem("digital_id_sign")'),
    cache,
  );

  await command('Page.navigate', { url: inquiryUrl + '&entry=more-stages' });
  await until(() =>
    evaluate(
      'location.search.endsWith("&entry=more-stages") && document.querySelector("h1")?.textContent === "Настройка рабочего места"',
    ),
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("main li strong")].some(row => row.textContent === "Криптопровайдер")',
    ),
    true,
  );

  await command('Emulation.setUserAgentOverride', {
    userAgent: 'Synthetic Setting Browser/2',
  });
  await command('Page.navigate', { url: inquiryUrl + '&entry=cache-miss' });
  await until(() =>
    evaluate(
      'location.search.endsWith("&entry=cache-miss") && document.querySelector("h1")?.textContent === "Настройка рабочего места"',
    ),
  );
  assert.equal(
    await evaluate('navigator.userAgent'),
    'Synthetic Setting Browser/2',
  );
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    false,
  );
  assert.equal(
    await evaluate('localStorage.getItem("digital_id_sign")'),
    cache,
  );
  assert.deepEqual(
    requests.map((url) => url.split('/').slice(-2).join('/')),
    [
      'corp-digital-id-sign/settings',
      'state/start',
      'poll/status',
      'corp-digital-id-sign/settings',
      'state/start',
      'corp-digital-id-sign/NO_CERT',
      'state/ready',
      'corp-digital-id-sign/settings',
      'state/start',
      'state/ready',
      'corp-digital-id-sign/settings',
      'state/start',
      'corp-digital-id-sign/settings',
      'state/start',
    ],
  );

  await command('Page.navigate', { url: base + '/?id=synthetic-check' });
  await until(() => evaluate('document.querySelector("main select") !== null'));
  assert.deepEqual(
    await evaluate(
      '[...document.querySelector("main select").options].map(option => option.textContent)',
    ),
    [
      'Выберите сертификат',
      'Тестов Иван · Организация 1 · 1',
      'Тестов Иван · Организация 2 · 2',
    ],
  );
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    true,
  );
  assert.equal(
    await evaluate('document.querySelector("main a").href'),
    'https://example.test/consent',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("main a").parentElement.textContent',
    ),
    'Прочитайте условия проверки. Подробнее.',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("main input[type=checkbox]").length',
    ),
    0,
  );
  await evaluate(`(() => {
    const select = document.querySelector('main select');
    select.value = 'SECOND';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    false,
  );
  assert.equal(checkForm, undefined);
  await evaluate('document.querySelector("main button").click()');
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Тестовая подпись принята"',
    ),
  );
  const form = await checkForm;
  const dto = JSON.parse(await form.get('request').text());
  assert.equal(dto.inquiry_id, 'synthetic-check');
  assert.deepEqual(dto.test_document, checkProcess.screen.test_document);
  assert.equal(dto.certificates.length, 1);
  const [certificate] = dto.certificates;
  assert.equal(certificate.thumbprint, 'SECOND');
  assert.equal(certificate.organization.name, 'Организация 2');
  assert.equal(certificate.issuer.name, 'Synthetic CA');
  assert.equal(certificate.certificate_base64, undefined);
  assert.equal(dto.signatures, undefined);
  const signatureFile = form.get('signatures');
  assert.equal(signatureFile.name, 'test.sig');
  assert.equal(signatureFile.type, 'application/pkcs7-signature');
  assert.equal(await signatureFile.text(), 'abc');
  const certificateFile = form.get('certificates');
  assert.equal(certificateFile.name, '2.b64');
  assert.equal(await certificateFile.text(), 'Y2VydA==');
  await evaluate('document.querySelector("main button").click()');
  await until(() => evaluate('document.querySelector("main select") !== null'));
  assert.equal(
    await evaluate('document.querySelector("main button").disabled'),
    true,
  );
  assert.equal(
    requests.filter((url) => url.endsWith('/state/check')).length,
    1,
  );

  await command('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: resolve(profile),
  });
  await command('Page.navigate', { url: base + '/?id=synthetic-documents' });
  await until(() =>
    evaluate('document.querySelector("h1")?.textContent === "Подписание"'),
  );
  assert.equal(
    await evaluate('document.querySelectorAll("main li").length'),
    5,
  );
  assert.deepEqual(documentRequests, []);

  await resize(360);
  await evaluate('document.querySelector("main li button").focus()');
  await key('Enter', 13);
  await evaluate('document.querySelector("main li button").click()');
  await until(() =>
    evaluate(
      'document.querySelector("main li")?.textContent.includes("Загружаем")',
    ),
  );
  await until(() =>
    evaluate('document.querySelector("dialog[open] iframe") !== null'),
  );
  assert.equal(documentRequests.length, 1);
  assert.equal(documentRequests[0].inquiry_id, 'synthetic-documents');
  assert.equal(documentRequests[0].document_id, 'preview');
  const previewUrl = await evaluate(
    'document.querySelector("dialog iframe").src',
  );
  assert.equal(
    await evaluate(
      `fetch(${JSON.stringify(previewUrl)}).then(response => response.headers.get("Content-Type"))`,
    ),
    'application/pdf',
  );
  const pdfTarget = await until(async () => {
    const { targetInfos } = await command('Target.getTargets');
    return targetInfos.find(({ url }) =>
      url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'),
    );
  });
  const { sessionId } = await command('Target.attachToTarget', {
    targetId: pdfTarget.targetId,
    flatten: true,
  });
  await until(async () => {
    const { result } = await command(
      'Runtime.evaluate',
      {
        expression:
          'document.querySelector("pdf-viewer")?.getLoadSucceededForTesting?.()',
        returnByValue: true,
      },
      sessionId,
    );
    return result.value === true;
  });
  await command('Target.detachFromTarget', { sessionId });
  await screenshot('signing-pdf-360');
  assert.equal(
    await evaluate(
      'document.querySelector("dialog").scrollWidth <= innerWidth',
    ),
    true,
  );
  await key('Escape', 27);
  await until(() =>
    evaluate(
      '!document.querySelector("dialog") && document.activeElement === document.querySelector("main li button")',
    ),
  );
  assert.equal(
    await evaluate(
      `fetch(${JSON.stringify(previewUrl)}).then(() => false, () => true)`,
    ),
    true,
  );

  const openDocument = (id) =>
    evaluate(
      `document.querySelectorAll("main li button")[${signingDocuments.findIndex((item) => item.id === id)}].click()`,
    );
  const verifyDownload = async (name, bytes) => {
    const downloaded = await until(async () => {
      try {
        return await readFile(join(profile, name));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    });
    assert.deepEqual(downloaded, bytes);
  };
  await openDocument('download');
  await until(() =>
    evaluate(
      'document.querySelector("dialog[open] a")?.download === "Данные JSON.json"',
    ),
  );
  await verifyDownload('Данные JSON.json', jsonBytes);
  assert.equal(
    await evaluate('!document.querySelector("dialog iframe, dialog img")'),
    true,
  );
  await evaluate('document.querySelector("dialog button").click()');

  await openDocument('broken-image');
  await until(() =>
    evaluate(
      'document.querySelector("dialog [role=status]")?.textContent.includes("Просмотр недоступен")',
    ),
  );
  await evaluate('document.querySelector("dialog a").click()');
  await verifyDownload('Синтетический PNG.png', pngBytes);
  await evaluate('document.querySelector("dialog button").click()');

  await openDocument('invalid');
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Ошибка получения документа"',
    ),
  );
  await evaluate('document.querySelector("main button").click()');
  await until(() =>
    evaluate('document.querySelectorAll("main li").length === 5'),
  );
  await openDocument('expired');
  await until(() =>
    evaluate(
      'document.querySelector("main li strong")?.textContent === "Новая группа"',
    ),
  );
  assert.equal(
    await evaluate('document.querySelectorAll("main li").length'),
    1,
  );
  assert.deepEqual(
    documentRequests.map(({ document_id }) => document_id),
    signingDocuments.map(({ id }) => id),
  );
  assert.equal(
    requests.some((url) => url.endsWith('/state/signing')),
    false,
  );

  const journeyStart = requests.length;
  signingJourney = true;
  await command('Page.navigate', { url: base + '/?id=synthetic-signing' });
  const settingButton = `[...document.querySelectorAll('main button')].find(button => button.textContent === 'Запустить проверку')`;
  const checkButton = `[...document.querySelectorAll('main button')].find(button => button.textContent === 'Выполнить тестовую подпись')`;
  await until(() => evaluate(`(${settingButton})?.disabled === false`));
  await evaluate(`${settingButton}.click()`);
  await until(() =>
    evaluate('document.querySelector("main select")?.options.length === 3'),
  );
  const previousCheckForm = checkForm;
  await evaluate(`(() => {
    const select = document.querySelector('main select');
    select.value = 'SECOND';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await evaluate(`${checkButton}.click()`);
  const signingButton = `[...document.querySelectorAll('main button')].find(button => button.textContent === 'Подписать документы')`;
  await until(() => evaluate(`Boolean(${signingButton})`));
  assert.notEqual(checkForm, previousCheckForm);
  const journeyCheck = await checkForm;
  assert.equal(
    JSON.parse(await journeyCheck.get('request').text()).inquiry_id,
    'synthetic-signing',
  );
  assert.deepEqual(
    journeyCheck.getAll('signatures').map(({ name }) => name),
    ['test.sig'],
  );
  assert.equal(await journeyCheck.get('signatures').text(), 'abc');
  assert.equal(await journeyCheck.get('certificates').text(), 'Y2VydA==');
  assert.equal(pollRequests.at(-1).task, 'check-complete');
  assert.equal(pollRequests.at(-1).inquiry_id, 'synthetic-signing');
  const firstDocument = 'document.querySelector("main li button")';
  await until(() => evaluate(`${firstDocument}?.disabled === false`));
  await evaluate(`${firstDocument}.click()`);
  await until(() =>
    evaluate('document.querySelector("dialog iframe") !== null'),
  );
  await key('Escape', 27);
  await until(() => evaluate('document.querySelector("dialog") === null'));
  await until(() =>
    evaluate('document.querySelector("main select")?.options.length === 3'),
  );
  assert.equal(await evaluate(`${signingButton}.disabled`), true);
  await evaluate(`(() => {
    const select = document.querySelector('main select');
    select.value = 'SECOND';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(signingForms.length, 0);
  await evaluate(
    `(() => { const button = ${signingButton}; button.click(); button.click(); })()`,
  );
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Подписание новой группы"',
    ),
  );
  await until(() => evaluate(`(${signingButton})?.disabled === false`));
  assert.equal(
    await evaluate('document.querySelector("main li strong")?.textContent'),
    'Документ новой группы',
  );
  assert.equal(signingForms.length, 1);
  await evaluate(`${signingButton}.click()`);
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Документы приняты"',
    ),
  );
  assert.equal(signingForms.length, 2);
  const apiRoutes = (since) =>
    requests.slice(since).map((url) => url.split('/').slice(-2).join('/'));
  assert.deepEqual(apiRoutes(journeyStart), [
    'corp-digital-id-sign/settings',
    'state/start',
    'state/ready',
    'state/check',
    'poll/status',
    'v1/document',
    'state/signing',
    'state/signing',
  ]);

  for (const [index, group, thumbprint, serial, signatures] of [
    [0, firstGroup, 'SECOND', '2', ['abc', 'def']],
    [1, secondGroup, 'FIRST', '1', ['ghi']],
  ]) {
    const form = await signingForms[index];
    const dto = JSON.parse(await form.get('request').text());
    assert.equal(dto.inquiry_id, 'synthetic-signing');
    assert.deepEqual(dto.documents, group.screen.lists.documents);
    assert.equal(dto.certificates.length, 1);
    assert.equal(dto.certificates[0].thumbprint, thumbprint);
    assert.equal(dto.certificates[0].certificate_base64, undefined);
    const files = form.getAll('signatures');
    assert.deepEqual(
      files.map(({ name }) => name),
      dto.documents.map(({ id }) => `${id}.sig`),
    );
    assert.ok(
      files.every(({ type }) => type === 'application/pkcs7-signature'),
    );
    assert.deepEqual(
      await Promise.all(files.map((file) => file.text())),
      signatures,
    );
    const certs = form.getAll('certificates');
    assert.deepEqual(
      certs.map(({ name }) => name),
      [`${serial}.b64`],
    );
    assert.equal(await certs[0].text(), 'Y2VydA==');
  }
  await evaluate('document.querySelector("main button").click()');
  await until(() => evaluate(`(${signingButton})?.disabled === false`));
  assert.equal(signingForms.length, 2);

  signingJourney = false;
  restartScenario = true;
  const restartStart = requests.length;
  await command('Page.navigate', { url: base + '/?id=synthetic-restart' });
  await until(() =>
    evaluate(
      'document.querySelector("h1")?.textContent === "Не удалось продолжить"',
    ),
  );
  assert.equal(
    await evaluate('document.querySelector("code").textContent'),
    'restart-2',
  );
  assert.deepEqual(
    pollRequests.slice(-2).map(({ inquiry_id, task }) => [inquiry_id, task]),
    [
      ['synthetic-restart', 'restart-1'],
      ['synthetic-restart', 'restart-2'],
    ],
  );
  assert.deepEqual(apiRoutes(restartStart), [
    'corp-digital-id-sign/settings',
    'state/start',
    'poll/status',
    'corp-digital-id-sign/settings',
    'state/start',
    'poll/status',
    'corp-digital-id-sign/RESPONSE_ERROR',
  ]);

  process.stdout.write(
    'Chromium UI checks passed. Screenshots saved to ' + output + '\n',
  );
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    await new Promise((resolve) => {
      chrome.once('exit', resolve);
      chrome.kill();
    });
  }
  await vite.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}
