import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { httpClient, localFallback } from '../shared/api';
import {
  checkProcess,
  settingProcess,
  settings,
  signingProcess,
  statusProcess,
  task,
  unsupportedSigningProcesses,
} from '../shared/api/__tests__/fixtures';
import { readInquiryId } from '../shared/readInquiryId';
import { defaultSettings } from './model';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { useProcess } from './useProcess';
import type { HasSettingCache } from './useProcess';
import { canActivate, useStatusActions } from './useStatusActions';

type Reply = {
  status?: number;
  data?: unknown;
  code?: string;
  requestId?: string;
};
type PendingReply = Reply | Promise<Reply>;
const originalAdapter = httpClient.defaults.adapter;
const dictionaryStatus = {
  ...localFallback,
  screen: { ...localFallback.screen, title: 'Справочник' },
};
const successStatus = {
  ...statusProcess,
  screen: { ...statusProcess.screen, level: 'SUCCESS' as const },
};

function route(replies: Record<string, PendingReply[]>) {
  const requests: { key: string; config: InternalAxiosRequestConfig }[] = [];
  httpClient.defaults.adapter = async (config) => {
    const key = config.url?.split('/').at(-1) ?? '';
    requests.push({ key, config });
    const reply = await replies[key]?.shift();
    if (!reply) throw new Error('Неожиданный запрос ' + key);
    if (reply.code) throw new AxiosError(reply.code, reply.code, config);
    const response: AxiosResponse<unknown> = {
      status: reply.status ?? 200,
      statusText: '',
      data: reply.data,
      headers: new AxiosHeaders(
        reply.requestId ? { 'X-Request-Id': reply.requestId } : {},
      ),
      config,
    };
    if (config.validateStatus && !config.validateStatus(response.status)) {
      throw new AxiosError(
        String(response.status),
        undefined,
        config,
        undefined,
        response,
      );
    }
    return response;
  };
  return {
    requests,
    keys: () => requests.map(({ key }) => key),
    body: (key: string, index = 0) =>
      JSON.parse(
        requests.filter((request) => request.key === key)[index].config.data,
      ) as Record<string, unknown>,
  };
}

const renderers = new Set<ReactTestRenderer>();

function makeProcess(
  inquiryId = 'synthetic-id',
  hasSettingCache?: HasSettingCache,
) {
  const navigate = jest.fn();
  let current!: ReturnType<typeof useProcess>;
  let activate!: ReturnType<typeof useStatusActions>;
  const displayed: string[] = [];

  function Probe() {
    current = useProcess(inquiryId, hasSettingCache);
    activate = useStatusActions(
      current.state.screen,
      current.commands.back,
      navigate,
    );
    displayed.push(current.state.screen.process);
    return null;
  }

  const tree = create(createElement(Probe));
  renderers.add(tree);
  return {
    get commands() {
      return current.commands;
    },
    activate: (slot: 'accent' | 'secondary') => activate(slot),
    unmount: () => {
      tree.unmount();
      renderers.delete(tree);
    },
    displayed,
    navigate,
    snapshot: () => current.state,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  for (const tree of renderers) act(() => tree.unmount());
  renderers.clear();
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['', '?id=', '?id=%20', '?id=one&id=two'])(
  'невалидная ссылка %s не запускает API',
  async (search) =>
    act(async () => {
      const { keys } = route({});
      const process = makeProcess(readInquiryId(search));
      await Promise.resolve();
      const { snapshot } = process;
      await process.commands.start();
      expect(keys()).toEqual([]);
      expect(snapshot().screen).toEqual({
        process: 'STATUS',
        screen: {
          level: 'WARNING',
          title: 'Ссылка недействительна',
          message: 'Откройте ссылку из SMS',
        },
      });
    }),
);

test.each([
  [{ data: settings }, settings],
  [{ data: { ...settings, pull_time: '5' } }, defaultSettings],
  [{ status: 204, data: settings }, defaultSettings],
  [{ code: 'ERR_NETWORK' }, defaultSettings],
])('START валидирует или целиком заменяет настройки', async (reply, expected) =>
  act(async () => {
    const { keys, body } = route({
      settings: [reply],
      start: [{ data: settingProcess }],
    });
    const process = makeProcess('synthetic-id');
    await Promise.resolve();
    const { snapshot } = process;
    await Promise.all([process.commands.start(), process.commands.start()]);
    await process.commands.start();
    expect(keys()).toEqual(['settings', 'start']);
    expect(snapshot()).toMatchObject({
      settings: expected,
      serverProcess: 'SETTING',
      session: settingProcess.session,
      screen: settingProcess,
    });
    expect(body('start')).toEqual({
      inquiry_id: 'synthetic-id',
      req_time: expect.any(String),
      sc_name: 'urn:front-corp-digital-id-microfront',
      sp_name: 'urn:corp-digital-id',
    });
  }),
);

test.each([checkProcess, signingProcess, statusProcess])(
  'START диспетчеризует $process',
  async (screen) =>
    act(async () => {
      route({ settings: [{ data: settings }], start: [{ data: screen }] });
      const process = makeProcess();
      await Promise.resolve();
      const { snapshot } = process;
      await process.commands.start();
      expect(snapshot()).toMatchObject({
        serverProcess: screen.process,
        lastResponse: screen,
        screen,
      });
    }),
);

test('кэш проверяется до смены экрана, session сохранена до ready, token обновляется', async () =>
  act(async () => {
    const cache = deferred<boolean>();
    const cached = { ...settingProcess, session: 'new-session' };
    const { body } = route({
      settings: [{ data: settings }],
      start: [{ data: cached }],
      ready: [{ data: task }],
      status: [{ data: signingProcess }],
    });
    const hasSettingCache = jest.fn<HasSettingCache>(() => cache.promise);
    const process = makeProcess('synthetic-id', hasSettingCache);
    await Promise.resolve();
    const { snapshot } = process;
    const run = process.commands.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(hasSettingCache).toHaveBeenCalledWith(
      'synthetic-id',
      cached,
      expect.any(AbortSignal),
    );
    expect(snapshot()).toMatchObject({
      session: cached.session,
      serverProcess: 'SETTING',
      screen: { process: 'START' },
    });
    expect(snapshot().previousProcess).toBeUndefined();
    cache.resolve(true);
    await jest.advanceTimersByTimeAsync(settings.pull_time);
    await run;
    expect(process.displayed).not.toContain('SETTING');
    expect(snapshot()).toMatchObject({
      session: cached.session,
      token: signingProcess.token,
      screen: signingProcess,
      previousProcess: 'WAITING',
    });
    expect(body('ready')).not.toHaveProperty('session');
    expect(body('status')).not.toHaveProperty('session');
  }));

test('новый SETTING и SIGNING заменяют только соответствующее поле; BACK сохраняет реквизиты', async () =>
  act(async () => {
    const nextSetting = { ...settingProcess, session: 'next-session' };
    const nextSigning = { ...signingProcess, token: 'next-token' };
    route({
      settings: [{ data: settings }],
      start: [{ data: settingProcess }],
      ready: [{ data: signingProcess }, { data: nextSigning }],
      signing: [{ data: nextSetting }, { data: statusProcess }],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    const prepare = async () => ({
      event: 'signing' as const,
      payload: {
        documents: signingProcess.screen.lists.documents,
        certificates: [],
      },
      files: { signatures: [], certificates: [] },
    });
    await process.commands.start();
    await process.commands.ready();
    await process.commands.submitSignature(prepare);
    expect(snapshot()).toMatchObject({
      token: signingProcess.token,
      session: nextSetting.session,
    });
    await process.commands.ready();
    await process.commands.submitSignature(prepare);
    await process.commands.back();
    expect(snapshot()).toMatchObject({
      token: nextSigning.token,
      session: nextSetting.session,
      serverProcess: 'STATUS',
      screen: nextSigning,
    });
  }));

test.each([200, 303])(
  'HTTP %s запускает последовательный poll с новым бюджетом и task',
  async (status) =>
    act(async () => {
      const { keys, body } = route({
        settings: [{ data: { ...settings, retry_count: 2 } }],
        start: [{ data: task, status }],
        status: [
          { status: 429 },
          { data: { task: 'second' } },
          { status: 504 },
          { data: checkProcess },
        ],
      });
      const process = makeProcess();
      await Promise.resolve();
      const { snapshot } = process;
      const run = process.commands.start();
      await jest.advanceTimersByTimeAsync(settings.pull_time - 1);
      expect(snapshot()).toMatchObject({
        screen: { process: 'WAITING' },
        task: task.task,
      });
      expect(keys()).toEqual(['settings', 'start']);
      await jest.advanceTimersByTimeAsync(1);
      expect(keys().filter((key) => key === 'status')).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(settings.retry_time);
      expect(snapshot().task).toBe('second');
      expect(snapshot().previousProcess).toBe('START');
      await jest.advanceTimersByTimeAsync(
        settings.pull_time + settings.retry_time,
      );
      await run;
      expect([0, 1, 2, 3].map((index) => body('status', index).task)).toEqual([
        task.task,
        task.task,
        'second',
        'second',
      ]);
      expect(body('status', 0)).toEqual(body('status', 1));
      expect(snapshot().screen).toEqual(checkProcess);
      expect(jest.getTimerCount()).toBe(0);
    }),
);

test.each(['start', 'status', 'document'])(
  '%s: матрица HTTP и X-Request-Id исходного ответа',
  async (endpoint) =>
    act(async () => {
      const invalid: Reply = { data: {}, requestId: 'origin' };
      const cases: [Reply, string][] = [
        [{ status: 503 }, 'SERVICE_UNAVAL'],
        [
          { status: 403 },
          endpoint === 'document'
            ? 'RESPONSE_DOC_DOWNLOAD_ERROR'
            : 'SERVICE_UNAVAL',
        ],
        ...[400, 500, 201, 502].map((status): [Reply, string] => [
          { status },
          endpoint === 'document'
            ? 'RESPONSE_DOC_DOWNLOAD_ERROR'
            : 'RESPONSE_ERROR',
        ]),
        [
          invalid,
          endpoint === 'document'
            ? 'RESPONSE_DOC_DOWNLOAD_ERROR'
            : 'RESPONSE_ERROR',
        ],
        [
          { code: 'ERR_NETWORK' },
          endpoint === 'document'
            ? 'RESPONSE_DOC_DOWNLOAD_ERROR'
            : 'RESPONSE_ERROR',
        ],
      ];
      for (const [reply, key] of cases) {
        const { keys } = route({
          settings: [{ data: settings }],
          start: [
            endpoint === 'start'
              ? { ...reply, requestId: 'origin' }
              : { data: endpoint === 'status' ? task : signingProcess },
          ],
          [key]: [{ data: dictionaryStatus, requestId: 'dictionary' }],
          ...(endpoint === 'start'
            ? {}
            : { [endpoint]: [{ ...reply, requestId: 'origin' }] }),
        });
        const process = makeProcess();
        await Promise.resolve();
        const { snapshot } = process;
        const run = process.commands.start();
        await jest.advanceTimersByTimeAsync(settings.pull_time);
        await run;
        if (endpoint === 'document')
          await process.commands.downloadDocument('doc-1');
        expect(keys().at(-1)).toBe(key);
        expect(keys().filter((value) => value === endpoint)).toHaveLength(1);
        expect(snapshot().errorKey).toBe(key);
        expect(snapshot().requestId).toBe(
          reply.code || (endpoint === 'document' && reply === invalid)
            ? undefined
            : 'origin',
        );
        expect(snapshot().screen).toEqual(dictionaryStatus);
      }
    }),
);

test.each([0, 1, 3])(
  'retry_count=%s ограничивает все попытки вместе с первой',
  async (retry_count) =>
    act(async () => {
      const { keys } = route({
        settings: [{ data: { ...settings, retry_count } }],
        start: [{ status: 429 }, { status: 504 }, { code: 'ECONNABORTED' }],
        RESPONSE_ERROR: [{ data: dictionaryStatus }],
      });
      const process = makeProcess();
      await Promise.resolve();
      const { snapshot } = process;
      const run = process.commands.start();
      await jest.runAllTimersAsync();
      await run;
      expect(keys().filter((key) => key === 'start')).toHaveLength(
        Math.max(1, retry_count),
      );
      expect(snapshot().errorKey).toBe('RESPONSE_ERROR');
    }),
);

test('таймаут retry с jitter повторяет только HTTP после вычисленной задержки', async () =>
  act(async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const { keys, body } = route({
      settings: [{ data: { ...settings, retry_addition: 4 } }],
      start: [{ code: 'ETIMEDOUT' }, { data: checkProcess }],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    const run = process.commands.start();
    await jest.advanceTimersByTimeAsync(4);
    expect(keys()).toEqual(['settings', 'start']);
    await jest.advanceTimersByTimeAsync(1);
    await run;
    expect(body('start', 1)).toEqual(body('start', 0));
    expect(snapshot().screen).toEqual(checkProcess);
  }));

test.each(['start', 'status', 'document'])(
  '%s: первый 401 перезапускает START, второй завершает попытку',
  async (endpoint) =>
    act(async () => {
      const next = endpoint === 'status' ? task : signingProcess;
      const { keys, body } = route({
        settings: [{ data: settings }, { data: settings }],
        start:
          endpoint === 'start'
            ? [{ status: 401 }, { data: task }]
            : [{ data: next }, { data: task }],
        status:
          endpoint === 'status'
            ? [{ status: 401 }, { status: 401 }]
            : [{ status: 401 }],
        document: [{ status: 401 }],
        RESPONSE_ERROR: [{ data: dictionaryStatus }],
      });
      const process = makeProcess();
      await Promise.resolve();
      const { snapshot } = process;
      const run = process.commands.start();
      await jest.runAllTimersAsync();
      await run;
      if (endpoint === 'document') {
        expect(snapshot().token).toBe(signingProcess.token);
        const download = process.commands.downloadDocument('doc-1');
        await jest.advanceTimersByTimeAsync(0);
        expect(snapshot().token).toBeUndefined();
        await jest.runAllTimersAsync();
        await download;
      }
      expect(keys().filter((key) => key === 'start')).toHaveLength(2);
      expect(body('start', 1)).not.toHaveProperty('token');
      expect(snapshot()).toMatchObject({
        errorKey: 'RESPONSE_ERROR',
        screen: dictionaryStatus,
      });
      expect(snapshot().session).toBeUndefined();
    }),
);

test.each([
  { status: 401 },
  { status: 204 },
  { data: { ...dictionaryStatus, process: 'CHECK' } },
])('сбой справочника не запускает новый START или getSettings', async (reply) =>
  act(async () => {
    const { keys } = route({
      settings: [{ data: settings }],
      start: [{ status: 500, requestId: 'origin' }],
      RESPONSE_ERROR: [reply],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    await process.commands.start();
    expect(keys()).toEqual(['settings', 'start', 'RESPONSE_ERROR']);
    expect(snapshot().screen).toEqual(localFallback);
    expect(snapshot().requestId).toBe('origin');
  }),
);

test('code/stage: известные CryptoPro ошибки, null и неизвестный код, локальный ErrorBoundary fallback', async () =>
  act(async () => {
    const { keys } = route({
      settings: [{ data: settings }],
      start: [{ data: checkProcess }],
      E_FAIL: [{ data: dictionaryStatus }],
      SIGN_FAILED: [{ data: dictionaryStatus }],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    await process.commands.start();
    await process.commands.reportCryptoError('0x80004005', 'setup');
    await process.commands.back();
    await process.commands.reportCryptoError('0x80004005', 'signing');
    await process.commands.back();
    await process.commands.reportCryptoError('Access denied', 'setup');
    expect(snapshot().screen).toEqual(localFallback);
    await process.commands.back();
    await process.commands.reportCryptoError('unexpected', 'setup');
    expect(snapshot().screen).toEqual(localFallback);
    await process.commands.back();
    process.commands.recoverFromRenderError();
    expect(snapshot().screen).toEqual(localFallback);
    expect(keys()).toEqual(['settings', 'start', 'E_FAIL', 'SIGN_FAILED']);
  }));

test.each([undefined, 0, 10])(
  'STATUS timer=%s и ручное действие выполняют URL только один раз',
  async (timer) =>
    act(async () => {
      route({
        settings: [{ data: settings }],
        start: [{ data: { ...successStatus, timer } }],
      });
      const process = makeProcess();
      await Promise.resolve();
      const { navigate } = process;
      await process.commands.start();
      await jest.advanceTimersByTimeAsync(timer ?? 50);
      expect(navigate).toHaveBeenCalledTimes(timer === undefined ? 0 : 1);
      await process.activate('accent');
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(
        'https://next.example.test/process?step=confirm',
      );
    }),
);

test.each(['WARNING', 'ERROR'])(
  'STATUS %s игнорирует timer и сохраняет ручное действие',
  async (level) =>
    act(async () => {
      const status = {
        ...statusProcess,
        timer: 0,
        screen: { ...statusProcess.screen, level },
      };
      route({ settings: [{ data: settings }], start: [{ data: status }] });
      const process = makeProcess();
      await Promise.resolve();
      const { snapshot, navigate } = process;
      await process.commands.start();

      expect(jest.getTimerCount()).toBe(0);
      await jest.runAllTimersAsync();
      expect(navigate).not.toHaveBeenCalled();
      expect(snapshot().screen).toEqual(status);

      await process.activate('accent');
      expect(navigate).toHaveBeenCalledTimes(1);
    }),
);

test.each([
  { message: 'Неизвестное действие', process: 'CHECK' },
  { message: 'Два действия', url: 'https://example.test/', process: 'BACK' },
  { message: 'Некорректная ссылка', url: 'javascript:void(0)' },
  { message: 'Относительный путь', url: '/help' },
  { message: 'Ссылка без схемы', url: '//example.test/help' },
  { message: 'Неполный HTTPS-адрес', url: 'https:example.test/help' },
])(
  'нераспознанный accent оставляет STATUS без таймера: $message',
  async (accent) =>
    act(async () => {
      const screen = {
        ...successStatus,
        screen: { ...successStatus.screen, buttons: { accent } },
      };
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: screen }],
      });
      const process = makeProcess();
      await Promise.resolve();
      const { snapshot, navigate } = process;
      await process.commands.start();
      expect(canActivate(accent)).toBe(false);
      await process.activate('accent');
      await jest.runAllTimersAsync();
      expect(snapshot().screen).toEqual(screen);
      expect(keys()).toEqual(['settings', 'start']);
      expect(navigate).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    }),
);

test.each(['timer', 'manual', 'stop', 'back'])(
  'STATUS: %s, BACK восстанавливает рабочий экран без повторной операции',
  async (mode) =>
    act(async () => {
      const status = {
        ...successStatus,
        timer: 20,
        screen: {
          ...successStatus.screen,
          buttons: {
            accent: { message: 'Назад', process: 'BACK' },
            secondary: {
              message: 'Подробнее',
              url: 'https://example.test/help',
            },
          },
        },
      };
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: settingProcess }],
        ready: [{ data: status }],
      });
      const process = makeProcess();
      await Promise.resolve();
      const { snapshot, navigate } = process;
      await process.commands.start();
      await process.commands.ready();
      expect(snapshot().previousProcess).toBe('SETTING');
      if (mode === 'manual') await process.activate('secondary');
      if (mode === 'stop') process.unmount();
      if (mode === 'back') await process.commands.back();
      await jest.advanceTimersByTimeAsync(20);
      expect(keys()).toEqual(['settings', 'start', 'ready']);
      expect(snapshot().screen).toEqual(
        mode === 'timer' || mode === 'back' ? settingProcess : status,
      );
      expect(snapshot().previousProcess).toBe(
        mode === 'timer' || mode === 'back' ? 'STATUS' : 'SETTING',
      );
      expect(navigate).toHaveBeenCalledTimes(mode === 'manual' ? 1 : 0);
      expect(jest.getTimerCount()).toBe(0);
    }),
);

test('BACK без рабочего экрана запускает START заново', async () =>
  act(async () => {
    const { keys } = route({
      settings: [{ data: settings }, { data: settings }],
      start: [
        { data: unsupportedSigningProcesses.batch },
        { data: checkProcess },
      ],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    await process.commands.start();
    expect(snapshot().screen).toEqual(localFallback);
    await process.activate('accent');
    expect(snapshot().screen).toEqual(checkProcess);
    expect(keys()).toEqual(['settings', 'start', 'settings', 'start']);
  }));

test('после unmount поздний poll игнорируется, новая заявка независима', async () =>
  act(async () => {
    const delayedPoll = deferred<Reply>();
    const { requests, body } = route({
      settings: [{ data: settings }, { data: settings }],
      start: [{ data: task }, { data: checkProcess }],
      status: [delayedPoll.promise],
    });
    const old = makeProcess('old');
    await Promise.resolve();
    const run = old.commands.start();
    await jest.advanceTimersByTimeAsync(settings.pull_time);
    const poll = requests.at(-1);
    expect(poll?.key).toBe('status');
    old.unmount();
    await Promise.resolve();
    expect(poll?.config.signal?.aborted).toBe(true);
    const current = makeProcess('new');
    await Promise.resolve();
    await current.commands.start();
    delayedPoll.resolve({ data: signingProcess });
    await run;
    expect(old.snapshot().screen.process).toBe('WAITING');
    expect(current.snapshot().screen).toEqual(checkProcess);
    expect(current.snapshot().token).toBeUndefined();
    expect(body('start', 1).inquiry_id).toBe('new');
  }));

test('поздняя подпись после BACK игнорируется и двойной вызов не запускает второй адаптер', async () =>
  act(async () => {
    const { keys } = route({
      settings: [{ data: settings }],
      start: [{ data: signingProcess }],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    await process.commands.start();
    const prepared = deferred<{
      event: 'signing';
      payload: {
        documents: typeof signingProcess.screen.lists.documents;
        certificates: [];
      };
      files: { signatures: []; certificates: [] };
    }>();
    const prepare = jest.fn(() => prepared.promise);
    const run = process.commands.submitSignature(prepare);
    await process.commands.submitSignature(prepare);
    expect(prepare).toHaveBeenCalledTimes(1);
    await process.commands.back();
    prepared.resolve({
      event: 'signing',
      payload: {
        documents: signingProcess.screen.lists.documents,
        certificates: [],
      },
      files: { signatures: [], certificates: [] },
    });
    await run;
    expect(snapshot().screen).toEqual(signingProcess);
    expect(keys()).toEqual(['settings', 'start']);
  }));

test('поздний cache hit не отправляет ready после отмены', async () =>
  act(async () => {
    const cache = deferred<boolean>();
    const { keys } = route({
      settings: [{ data: settings }],
      start: [{ data: settingProcess }],
    });
    const process = makeProcess('old', () => cache.promise);
    await Promise.resolve();
    const { snapshot } = process;
    const run = process.commands.start();
    await jest.advanceTimersByTimeAsync(0);
    process.unmount();
    cache.resolve(true);
    await run;
    expect(snapshot().screen.process).toBe('START');
    expect(keys()).toEqual(['settings', 'start']);
  }));

test('явный повтор после второго 401 восстанавливает бюджет одного рестарта', async () =>
  act(async () => {
    const { keys } = route({
      settings: Array.from({ length: 4 }, () => ({ data: settings })),
      start: [
        { status: 401 },
        { status: 401 },
        { status: 401 },
        { data: checkProcess },
      ],
      RESPONSE_ERROR: [{ data: dictionaryStatus }],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    await process.commands.start();
    expect(snapshot().errorKey).toBe('RESPONSE_ERROR');
    await process.commands.retry();
    expect(keys().filter((key) => key === 'start')).toHaveLength(4);
    expect(snapshot().screen).toEqual(checkProcess);
  }));

test('CHECK повторяет отправку готовых файлов при 429, локальный timeout подписи завершает операцию', async () =>
  act(async () => {
    const { requests, keys } = route({
      settings: [{ data: settings }],
      start: [{ data: checkProcess }],
      check: [{ status: 429 }, { data: checkProcess }, { code: 'ETIMEDOUT' }],
      RESPONSE_ERROR: [{ data: dictionaryStatus }],
    });
    const process = makeProcess();
    await Promise.resolve();
    const { snapshot } = process;
    const prepare = jest.fn(async () => ({
      event: 'check' as const,
      payload: {
        test_document: checkProcess.screen.test_document,
        certificates: [],
      },
      files: {
        signatures: [{ fileName: 'test', base64: 'YWJj' }],
        certificates: [],
      },
    }));
    await process.commands.start();
    const submit = process.commands.submitSignature(prepare);
    await jest.runAllTimersAsync();
    await submit;
    expect(prepare).toHaveBeenCalledTimes(1);
    const forms = requests
      .filter(({ key }) => key === 'check')
      .map(({ config }) => config.data as FormData);
    expect(forms).toHaveLength(2);
    expect(await (forms[0].get('request') as File).text()).toBe(
      await (forms[1].get('request') as File).text(),
    );
    for (const form of forms) {
      const file = form.get('signatures') as File;
      expect(file.name).toBe('test.sig');
      expect(await file.text()).toBe('abc');
    }
    const timeout = process.commands.submitSignature(prepare);
    await jest.runAllTimersAsync();
    await timeout;
    expect(keys().filter((key) => key === 'check')).toHaveLength(3);
    expect(snapshot().errorKey).toBe('RESPONSE_ERROR');
  }));
