/* global fetch, WebSocket */
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { createServer as createViteServer } from 'vite';

const [browser, output = 'docs/signing/ui-screenshots'] = process.argv.slice(2);
assert(browser, 'Pass the path to Chrome');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'signing-ui-'));
const vite = await createViteServer({
  server: { middlewareMode: true, ws: false },
});
const { settingProcess, settings } = await vite.ssrLoadModule(
  '/src/shared/api/__tests__/fixtures.ts',
);
const requests = [];
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
    if (requests.filter((url) => url.endsWith('/state/start')).length === 1) {
      response.statusCode = 303;
      response.end('{"task":"ui-fixture"}');
    } else {
      response.end(JSON.stringify(settingProcess));
    }
  } else if (request.url.endsWith('/poll/status')) {
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
      if (error.code !== 'ENOENT') throw error;
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

  function command(method, params = {}) {
    const id = ++sequence;
    return Promise.race([
      new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
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
  assert.equal(
    await evaluate(
      '!document.querySelector("dialog") && document.activeElement === document.querySelector("main li button") && document.querySelector("main select").value === "second"',
    ),
    true,
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

  await command('Page.navigate', { url: base + '/?id=synthetic-inquiry' });
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
    true,
  );
  assert.deepEqual(
    requests.map((url) => url.split('/').slice(-2).join('/')),
    [
      'corp-digital-id-sign/settings',
      'state/start',
      'poll/status',
      'corp-digital-id-sign/settings',
      'state/start',
    ],
  );

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
