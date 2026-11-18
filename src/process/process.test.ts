import { sessionStorage, sessionTtl } from './sessionStorage';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { settingStages } from '../screens/setting/checkWorkplace';
import { httpClient, localFallback } from '../shared/api';
import {
  checkProcess,
  documentMetadata,
  documentMultipart,
  settingProcess,
  settings,
  signingProcess,
  statusProcess,
  task,
  unsupportedSigningProcesses,
} from '../shared/api/__tests__/fixtures';
import { readInquiryId } from '../shared/readInquiryId';
import {
  findCertificates,
  signHash,
  signHashes,
} from '../shared/services/cryptoPro/adapter';
import { CryptoProError } from '../shared/services/cryptoPro/error';
import {
  checkBrowserPlugin,
  readCspVersion,
} from '../shared/services/cryptoPro/workplace';
import { defaultSettings } from './model';
import { ProcessErrorBoundary } from './ProcessErrorBoundary';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { useProcess } from './useProcess';
import { createSettingCache } from './settingCache';
import type { SettingCache } from './settingCache';
import { canActivate, useStatusActions } from './useStatusActions';

type Reply = {
  status?: number;
  data?: unknown;
  code?: string;
  requestId?: string;
  contentType?: string;
};
type PendingReply = Reply | Promise<Reply>;
jest.mock('../shared/services/cryptoPro/adapter', () => ({
  findCertificates: jest.fn(),
  signHash: jest.fn(),
  signHashes: jest.fn(),
}));
jest.mock('../shared/services/cryptoPro/workplace', () => ({
  checkBrowserPlugin: jest.fn(),
  readCspVersion: jest.fn(),
}));
jest.mock('../screens/shared/Screen.module.css', () => ({ default: {} }));
jest.mock('../screens/status/StatusScreen.module.css', () => ({ default: {} }));

const plugin = jest.mocked(checkBrowserPlugin);
const csp = jest.mocked(readCspVersion);
const certificates = jest.mocked(findCertificates);
const sign = jest.mocked(signHash);
const signDocuments = jest.mocked(signHashes);
const syntheticCertificates = [
  {
    type: 'signed' as const,
    serial_number: '01',
    thumbprint: 'SYNTHETIC',
    expires_at: '2030-01-01T00:00:00.000Z',
    person: {},
    organization: {},
    issuer: {},
  },
];
const signedCertificate = {
  ...syntheticCertificates[0],
  person: {
    last_name: 'Тестов',
    first_name: 'Иван',
    inn: '123456789012',
  },
  organization: { name: 'Тестовая организация' },
  issuer: { name: 'Тестовый УЦ' },
  certificate_base64: 'Y2VydA==',
};
const signedHash = { signatureBase64: 'YWJj', certificate: signedCertificate };

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
      headers: new AxiosHeaders({
        'X-Request-Id': reply.requestId ?? null,
        'content-type': reply.contentType ?? null,
      }),
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
    sessions: (key: string) =>
      requests
        .filter((request) => request.key === key)
        .map(({ config }) => config.headers.get('Session-id')),
    body: (key: string, index = 0) =>
      JSON.parse(
        requests.filter((request) => request.key === key)[index].config.data,
      ) as Record<string, unknown>,
  };
}

const renderers = new Set<ReactTestRenderer>();

function makeProcess(inquiryId = 'synthetic-id', settingCache?: SettingCache) {
  const navigate = jest.fn();
  let current!: ReturnType<typeof useProcess>;
  let activate!: ReturnType<typeof useStatusActions>;
  const displayed: string[] = [];

  function Probe() {
    current = useProcess(inquiryId, settingCache);
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
  sessionStorage.clear();
  plugin.mockReset().mockResolvedValue(undefined);
  csp.mockReset().mockResolvedValue({ major: 5, minor: 0, build: 1 });
  certificates.mockReset().mockResolvedValue(syntheticCertificates);
  sign.mockReset().mockResolvedValue(signedHash);
  signDocuments.mockReset().mockImplementation(async (_input, documents) => ({
    signatures: documents.map(() => signedHash.signatureBase64),
    certificate: signedCertificate,
  }));
});
afterEach(() => {
  for (const tree of renderers) act(() => tree.unmount());
  renderers.clear();
  httpClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
  sessionStorage.clear();
  jest.useRealTimers();
});

test.each(['', '?id=', '?id=%20', '?id=one&id=two'])(
  'невалидная ссылка %s не запускает API',
  async (search) =>
    act(async () => {
      const { keys } = route({});
      const has = jest.fn(() => true);
      const process = makeProcess(readInquiryId(search), {
        has,
        save: jest.fn(),
      });
      await Promise.resolve();
      const { snapshot } = process;
      await process.commands.start();
      expect(keys()).toEqual([]);
      expect(has).not.toHaveBeenCalled();
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
    const { keys, body, sessions } = route({
      settings: [reply],
      start: [{ data: settingProcess }],
    });
    const process = makeProcess('synthetic-id');
    await Promise.resolve();
    const { snapshot } = process;
    await Promise.all([process.commands.start(), process.commands.start()]);
    await process.commands.start();
    expect(keys()).toEqual(['settings', 'start']);
    expect(sessions('settings')).toEqual([null]);
    expect(sessions('start')).toEqual([null]);
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

test('SETTING без session даёт ошибку валидации', async () =>
  act(async () => {
    const { keys, sessions } = route({
      settings: [{ data: settings }],
      start: [{ data: { ...settingProcess, session: undefined } }],
      RESPONSE_ERROR: [{ data: dictionaryStatus }],
    });
    const process = makeProcess();
    await Promise.resolve();
    await process.commands.start();
    expect(process.snapshot().errorKey).toBe('RESPONSE_ERROR');
    expect(process.snapshot().session).toBeUndefined();
    expect(keys()).toEqual(['settings', 'start', 'RESPONSE_ERROR']);
    expect(sessions('RESPONSE_ERROR')).toEqual([null]);
  }));

test('прямой переход из START в SIGNING не отправляет Session-id без сессии', async () =>
  act(async () => {
    const { sessions, requests } = route({
      settings: [{ data: settings }],
      start: [{ data: signingProcess }],
      document: [{ status: 400 }],
      RESPONSE_DOC_DOWNLOAD_ERROR: [{ data: dictionaryStatus }],
    });
    const process = makeProcess();
    await Promise.resolve();
    await process.commands.start();
    expect(process.snapshot().screen).toEqual(signingProcess);
    await process.commands.downloadDocument('doc-1');
    expect(sessions('document')).toEqual([null]);
    expect(
      requests
        .find(({ key }) => key === 'document')
        ?.config.headers.get('X-integrity-token'),
    ).toBe(signingProcess.token);
    expect(
      requests
        .filter(({ key }) => key !== 'document')
        .every(({ config }) => !config.headers.has('X-integrity-token')),
    ).toBe(true);
    expect(process.snapshot().errorKey).toBe('RESPONSE_DOC_DOWNLOAD_ERROR');
  }));

test('кэш проверяется до смены экрана, session сохранена до ready, token обновляется', async () =>
  act(async () => {
    const cache = deferred<boolean>();
    const cached = { ...settingProcess, session: 'new-session' };
    const { body, sessions } = route({
      settings: [{ data: settings }],
      start: [{ data: cached }],
      ready: [{ data: task }],
      status: [{ data: signingProcess }],
    });
    const has = jest.fn<SettingCache['has']>(() => cache.promise);
    const process = makeProcess('synthetic-id', { has, save: jest.fn() });
    await Promise.resolve();
    const { snapshot } = process;
    const run = process.commands.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(has).toHaveBeenCalledWith('synthetic-id');
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
    expect(sessions('ready')).toEqual([cached.session]);
    expect(sessions('status')).toEqual([cached.session]);
  }));

test('новый SETTING и SIGNING заменяют только соответствующее поле; BACK сохраняет реквизиты', async () =>
  act(async () => {
    const nextSetting = { ...settingProcess, session: 'next-session' };
    const nextSigning = { ...signingProcess, token: 'next-token' };
    const { sessions } = route({
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
    await process.commands.checkSetting();
    await process.commands.submitSignature(prepare);
    expect(snapshot()).toMatchObject({
      token: signingProcess.token,
      session: nextSetting.session,
    });
    await process.commands.checkSetting();
    await process.commands.submitSignature(prepare);
    await process.commands.back();
    expect(snapshot()).toMatchObject({
      token: nextSigning.token,
      session: nextSetting.session,
      serverProcess: 'STATUS',
      screen: nextSigning,
    });
    expect(sessions('ready')).toEqual([
      settingProcess.session,
      nextSetting.session,
    ]);
    expect(sessions('signing')).toEqual([
      settingProcess.session,
      nextSetting.session,
    ]);
  }));

test.each([
  { response: checkProcess, expected: checkProcess },
  { response: settingProcess, expected: localFallback },
])(
  'cache hit из SIGNING оставляет экран до ready; ответ $response.process не вызывает второй ready',
  async ({ response, expected }) =>
    act(async () => {
      const ready = deferred<Reply>();
      const responding = deferred<void>();
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: signingProcess }],
        signing: [{ data: settingProcess }],
        ready: [ready.promise],
      });
      const storage = new Map<string, string>();
      const cache = createSettingCache(
        () => 'synthetic-device',
        () => ({
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
        }),
      );
      cache.save('synthetic-id');
      const process = makeProcess('synthetic-id', {
        ...cache,
        has: (id) => {
          responding.resolve();
          return cache.has(id);
        },
      });
      await Promise.resolve();
      await process.commands.start();
      const sign = process.commands.submitSignature(async () => ({
        event: 'signing',
        payload: {
          documents: signingProcess.screen.lists.documents,
          certificates: [],
        },
        files: { certificates: [], signatures: [] },
      }));
      await responding.promise;
      expect(process.snapshot()).toMatchObject({
        screen: signingProcess,
        session: settingProcess.session,
        busy: true,
      });
      ready.resolve({ data: response });
      await sign;
      expect(process.displayed).not.toContain('SETTING');
      expect(process.snapshot().screen).toEqual(expected);
      expect(keys()).toEqual(['settings', 'start', 'signing', 'ready']);
      expect(plugin).toHaveBeenCalledTimes(1);
      expect(csp).toHaveBeenCalledTimes(1);
    }),
);

test('ошибка ready при cache hit не запускает ручную проверку и не показывает SETTING', async () =>
  act(async () => {
    const { keys, sessions } = route({
      settings: [{ data: settings }],
      start: [{ data: settingProcess }],
      ready: [{ status: 503, requestId: 'ready-error' }],
      SERVICE_UNAVAL: [{ data: dictionaryStatus }],
    });
    const process = makeProcess('synthetic-id', {
      has: () => true,
      save: jest.fn(),
    });
    await Promise.resolve();
    await process.commands.start();
    expect(process.displayed).not.toContain('SETTING');
    expect(process.snapshot()).toMatchObject({
      screen: dictionaryStatus,
      requestId: 'ready-error',
      errorKey: 'SERVICE_UNAVAL',
    });
    expect(keys()).toEqual(['settings', 'start', 'ready', 'SERVICE_UNAVAL']);
    expect(sessions('SERVICE_UNAVAL')).toEqual([settingProcess.session]);
    expect(plugin).not.toHaveBeenCalled();
  }));

test('401 от загрузки настроек отключает Session-id до валидного SETTING', async () =>
  act(async () => {
    const { keys, sessions } = route({
      settings: [{ status: 401 }],
      start: [{ data: settingProcess }],
      ready: [{ data: signingProcess }],
    });
    const process = makeProcess('synthetic-id', {
      has: () => true,
      save: jest.fn(),
    });
    await Promise.resolve();
    await process.commands.start();
    expect(keys()).toEqual(['settings', 'start', 'ready']);
    expect(sessions('settings')).toEqual([null]);
    expect(sessions('start')).toEqual([null]);
    expect(sessions('ready')).toEqual([settingProcess.session]);
  }));

test('401 от справочника ошибок отключает Session-id при явном повторе', async () =>
  act(async () => {
    const { keys, sessions } = route({
      settings: [{ data: settings }, { data: settings }],
      start: [{ data: settingProcess }, { data: signingProcess }],
      ready: [{ status: 503 }],
      SERVICE_UNAVAL: [{ status: 401 }],
    });
    const process = makeProcess('synthetic-id', {
      has: () => true,
      save: jest.fn(),
    });
    await Promise.resolve();
    await process.commands.start();
    expect(keys()).toEqual(['settings', 'start', 'ready', 'SERVICE_UNAVAL']);
    expect(sessions('SERVICE_UNAVAL')).toEqual([settingProcess.session]);
    expect(process.snapshot().session).toBeNull();
    await process.commands.retry();
    expect(sessions('settings')).toEqual([null, null]);
    expect(sessions('start')).toEqual([null, null]);
    expect(process.snapshot().screen).toEqual(signingProcess);
  }));

test('полная ручная проверка выполняется по порядку, сохраняет список и переживает отказ записи', async () =>
  act(async () => {
    const filters = { person: { inn: '123456789012' } };
    const checkResponse = {
      ...checkProcess,
      cryptopro: { ...checkProcess.cryptopro, filters },
    };
    const { keys } = route({
      settings: [{ data: settings }],
      start: [
        {
          data: {
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
                  ...settingProcess.screen.lists.testing,
                ],
              },
            },
          },
        },
      ],
      ready: [{ status: 429 }, { data: checkResponse }],
    });
    const order: string[] = [];
    const pluginDone = deferred<void>();
    const cspDone = deferred<Awaited<ReturnType<typeof readCspVersion>>>();
    const certificatesDone = deferred<typeof syntheticCertificates>();
    const cache = createSettingCache(
      () => 'synthetic-device',
      () => ({
        getItem: () => null,
        setItem: () => {
          order.push('save');
          throw new Error('Storage full');
        },
      }),
    );
    plugin.mockImplementation(async () => {
      order.push('extension');
      return pluginDone.promise;
    });
    csp.mockImplementation(async () => {
      order.push('program');
      return cspDone.promise;
    });
    certificates.mockImplementation(async () => {
      order.push('certificate');
      return certificatesDone.promise;
    });
    const process = makeProcess('synthetic-id', cache);
    await Promise.resolve();
    await process.commands.start();
    expect(order).toEqual([]);
    const check = process.commands.checkSetting();
    await process.commands.checkSetting();
    expect(order).toEqual(['extension']);
    expect(process.snapshot().settingProgress).toEqual({
      extension: { state: 'RUNNING' },
    });
    pluginDone.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['extension', 'program']);
    expect(process.snapshot().settingProgress).toEqual({
      extension: { state: 'SUCCESS' },
      program: { state: 'RUNNING' },
    });

    cspDone.resolve({ major: 5, minor: 0, build: 1 });
    await jest.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['extension', 'program', 'certificate']);
    expect(process.snapshot().settingProgress).toEqual({
      extension: { state: 'SUCCESS' },
      program: { state: 'SUCCESS' },
      certificate: { state: 'RUNNING' },
    });
    expect(keys()).toEqual(['settings', 'start']);

    certificatesDone.resolve(syntheticCertificates);
    await jest.advanceTimersByTimeAsync(settings.retry_time);
    await check;
    expect(order).toEqual([
      'extension',
      'program',
      'certificate',
      'save',
      'certificate',
    ]);
    expect(certificates.mock.calls).toEqual([[], [filters]]);
    expect(keys()).toEqual(['settings', 'start', 'ready', 'ready']);
    expect(process.snapshot()).toMatchObject({
      screen: checkResponse,
      workplaceCertificates: syntheticCertificates,
      settingProgress: {
        extension: { state: 'SUCCESS' },
        program: { state: 'SUCCESS' },
        certificate: { state: 'SUCCESS' },
      },
    });
  }));

test.each([
  ['extension', 'EXTENSION_MISSING'],
  ['plugin', 'PLUGIN_NATIVE_ERROR'],
  ['csp', 'NTE_BAD_KEYSET'],
  ['certificate', 'NO_CERT'],
] as const)(
  'отказ %s открывает %s по кнопке и позволяет повторить проверку через BACK',
  async (stage, key) =>
    act(async () => {
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: settingProcess }],
        [key]: [{ data: dictionaryStatus }],
        ready: [{ data: checkProcess }],
      });
      const code = {
        extension: 'cadesplugin_extension_loaded=false',
        plugin: 'cadesplugin_load_error',
        csp: '0x80090016',
        certificate: 'NO_CERT',
      }[stage];
      const error = new CryptoProError(stage, code);
      const failedStage =
        stage === 'csp' ? 'program' : stage === 'plugin' ? 'extension' : stage;
      if (failedStage === 'extension') plugin.mockRejectedValueOnce(error);
      else if (failedStage === 'program') csp.mockRejectedValueOnce(error);
      else certificates.mockRejectedValueOnce(error);

      const cache = { has: jest.fn(() => false), save: jest.fn() };
      const process = makeProcess('synthetic-id', cache);
      await Promise.resolve();
      await process.commands.start();
      await process.commands.checkSetting();
      expect(process.snapshot().screen).toEqual(settingProcess);
      expect(process.snapshot().settingProgress).toEqual({
        ...(failedStage === 'extension'
          ? {}
          : { extension: { state: 'SUCCESS' } }),
        ...(failedStage === 'certificate'
          ? { program: { state: 'SUCCESS' } }
          : {}),
        [failedStage]: { state: 'ERROR', code },
      });
      expect(cache.save).not.toHaveBeenCalled();
      expect(keys()).toEqual(['settings', 'start']);
      await process.commands.showSettingError(failedStage);
      expect(process.snapshot()).toMatchObject({
        screen: dictionaryStatus,
        errorKey: key,
      });
      await process.activate('accent');
      expect(process.snapshot().screen).toEqual(settingProcess);
      await process.commands.checkSetting();
      expect(keys()).toEqual(['settings', 'start', key, 'ready']);
      expect(cache.save).toHaveBeenCalledTimes(1);
    }),
);

test.each([true, false])(
  'CSP ниже 5.0 останавливает проверку до поиска сертификатов, строка CSP: %s',
  async (showCsp) =>
    act(async () => {
      const response = {
        ...settingProcess,
        screen: {
          ...settingProcess.screen,
          lists: {
            testing: settingProcess.screen.lists.testing.filter(
              ({ name }) => showCsp || name !== 'program',
            ),
          },
        },
      };
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: response }],
      });
      csp.mockResolvedValue({ major: 4, minor: 99, build: 99999 });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      await process.commands.checkSetting();
      expect(process.snapshot().settingProgress?.program?.state).toBe('ERROR');
      expect(certificates).not.toHaveBeenCalled();
      if (showCsp) {
        expect(process.snapshot().screen).toEqual(response);
        await process.commands.showSettingError('program');
      }
      expect(process.snapshot().screen).toMatchObject({
        process: 'STATUS',
        screen: { title: 'Версия КриптоПро CSP не подходит' },
      });
      expect(keys()).toEqual(['settings', 'start']);
      if (!showCsp) {
        await process.commands.back();
        expect(process.snapshot().screen).toEqual(response);
      }
    }),
);

test.each([
  { names: ['certificate', 'extension', 'extension'] },
  { names: ['extension'] },
  { names: [] },
  { names: ['synthetic-extra'] },
  { names: undefined },
])(
  'SETTING с визуальным списком $names выполняет все проверки и отправляет ready',
  async ({ names }) =>
    act(async () => {
      const response = {
        ...settingProcess,
        screen: {
          ...settingProcess.screen,
          lists: names && {
            testing: names.map((name) => ({
              ...settingProcess.screen.lists.testing[0],
              name,
            })),
          },
        },
      };
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: response }],
        ready: [{ data: checkProcess }],
      });
      const cache = {
        has: jest.fn<SettingCache['has']>(() => false),
        save: jest.fn<SettingCache['save']>(),
      };
      const process = makeProcess('synthetic-id', cache);
      await Promise.resolve();
      await process.commands.start();
      expect(process.snapshot().screen).toEqual(response);
      expect(cache.has).toHaveBeenCalledWith('synthetic-id');
      expect(keys()).toEqual(['settings', 'start']);
      await process.commands.checkSetting();
      expect(plugin).toHaveBeenCalledTimes(1);
      expect(csp).toHaveBeenCalledTimes(1);
      expect(certificates).toHaveBeenCalledTimes(2);
      expect(Object.keys(process.snapshot().settingProgress ?? {})).toEqual(
        settingStages,
      );
      expect(cache.save).toHaveBeenCalledWith('synthetic-id');
      expect(process.snapshot().screen).toEqual(checkProcess);
      expect(keys()).toEqual(['settings', 'start', 'ready']);
    }),
);

test('поздний поиск сертификатов старой заявки не пишет кэш и не отправляет ready', async () =>
  act(async () => {
    const { keys } = route({
      settings: [{ data: settings }, { data: settings }],
      start: [{ data: settingProcess }, { data: settingProcess }],
    });
    const pending = deferred<typeof syntheticCertificates>();
    const started = deferred<void>();
    certificates.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const cache = { has: jest.fn(() => false), save: jest.fn() };
    const old = makeProcess('old', cache);
    await Promise.resolve();
    await old.commands.start();
    const check = old.commands.checkSetting();
    await started.promise;
    old.unmount();
    const next = makeProcess('next', cache);
    await Promise.resolve();
    await next.commands.start();
    pending.resolve(syntheticCertificates);
    await check;
    expect(cache.save).not.toHaveBeenCalled();
    expect(next.snapshot()).toMatchObject({
      inquiryId: 'next',
      screen: settingProcess,
    });
    expect(keys()).toEqual(['settings', 'start', 'settings', 'start']);
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

function documentReply(
  options?: Parameters<typeof documentMultipart>[0],
): Reply {
  const { body, contentType } = documentMultipart(options);
  return { data: body, contentType };
}

test.each([
  { omit: 'response' },
  { omit: 'file' },
  { json: '{' },
  { json: JSON.stringify({ ...documentMetadata, format: 123 }) },
  { json: JSON.stringify({ ...documentMetadata, document_id: 'doc-2' }) },
  { file: 'not;base64' },
  { file: ' \t' },
] as const)(
  'тело документа %j даёт ошибку без retry, BACK восстанавливает список',
  async (options) =>
    act(async () => {
      const key = 'RESPONSE_DOC_DOWNLOAD_ERROR';
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: signingProcess }],
        document: [documentReply(options)],
        [key]: [{ data: dictionaryStatus }],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      expect(await process.commands.downloadDocument('doc-1')).toBeUndefined();
      expect(process.snapshot().errorKey).toBe(key);
      await process.commands.back();
      expect(process.snapshot().screen).toEqual(signingProcess);
      expect(keys()).toEqual(['settings', 'start', 'document', key]);
      expect(sign).not.toHaveBeenCalled();
    }),
);

test.each([0, 1, 3])(
  'REST.03 ограничивает число попыток при retry_count=%s',
  async (retry_count) =>
    act(async () => {
      const key = 'RESPONSE_DOC_DOWNLOAD_ERROR';
      const { keys, body } = route({
        settings: [{ data: { ...settings, retry_count } }],
        start: [{ data: signingProcess }],
        document: [{ status: 429 }, { status: 504 }, { code: 'ETIMEDOUT' }],
        [key]: [{ data: dictionaryStatus }],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      const pending = process.commands.downloadDocument('doc-1');
      await jest.runAllTimersAsync();
      await pending;
      expect(process.snapshot().errorKey).toBe(key);
      expect(keys().filter((key) => key === 'document')).toHaveLength(
        Math.max(1, retry_count),
      );
      if (retry_count === 3)
        expect(body('document', 2)).toEqual(body('document'));
    }),
);

test.each(['finish', 'back', 'unmount'] as const)(
  'REST.03 получает только выбранный документ и учитывает %s',
  async (action) =>
    act(async () => {
      const late = deferred<Reply>();
      const { keys, body, requests } = route({
        settings: [{ data: settings }],
        start: [{ data: signingProcess }],
        document: [late.promise],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      await process.commands.downloadDocument('unknown');
      expect(keys()).toEqual(['settings', 'start']);
      const pending = process.commands.downloadDocument('doc-1');
      expect(await process.commands.downloadDocument('doc-1')).toBeUndefined();
      expect(keys()).toEqual(['settings', 'start', 'document']);
      expect(body('document')).toMatchObject({
        inquiry_id: 'synthetic-id',
        document_id: 'doc-1',
      });
      if (action === 'back') await process.commands.back();
      if (action === 'unmount') process.unmount();
      expect(requests.at(-1)?.config.signal?.aborted).toBe(action !== 'finish');
      late.resolve(documentReply());
      expect(await pending).toEqual(
        action === 'finish'
          ? { title: documentMetadata.title, format: 'PDF', binary: 'abc' }
          : undefined,
      );
      expect(keys()).toEqual(['settings', 'start', 'document']);
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
      await jest.advanceTimersByTimeAsync(100);
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
      const next = endpoint === 'status' ? task : settingProcess;
      const { keys, body, sessions } = route({
        settings: [{ data: settings }, { data: settings }],
        start:
          endpoint === 'start'
            ? [{ status: 401 }, { data: task }]
            : [{ data: next }, { data: task }],
        status:
          endpoint === 'status'
            ? [{ status: 401 }, { status: 401 }]
            : [{ status: 401 }],
        ready: [{ data: signingProcess }],
        document: [{ status: 401 }],
        RESPONSE_ERROR: [{ data: dictionaryStatus }],
      });
      const process = makeProcess('synthetic-id', {
        has: () => true,
        save: jest.fn(),
      });
      await Promise.resolve();
      const { snapshot } = process;
      const run = process.commands.start();
      await jest.advanceTimersByTimeAsync(20000);
      await run;
      if (endpoint === 'document') {
        expect(snapshot().token).toBe(signingProcess.token);
        expect(snapshot().session).toBe(settingProcess.session);
        const download = process.commands.downloadDocument('doc-1');
        await jest.advanceTimersByTimeAsync(0);
        expect(snapshot().token).toBeUndefined();
        expect(snapshot().session).toBeNull();
        await jest.runAllTimersAsync();
        await download;
        expect(sessions('document')).toEqual([settingProcess.session]);
      }
      expect(keys().filter((key) => key === 'start')).toHaveLength(2);
      expect(body('start', 1)).not.toHaveProperty('token');
      expect(body('start', 1)).not.toHaveProperty('session');
      expect(sessions('settings')).toEqual([null, null]);
      expect(sessions('start')).toEqual([null, null]);
      expect(sessions('RESPONSE_ERROR')).toEqual([null]);
      expect(snapshot()).toMatchObject({
        errorKey: 'RESPONSE_ERROR',
        screen: dictionaryStatus,
      });
      expect(snapshot().session).toBeNull();
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

test('code/stage: известные ошибки CryptoPro используют справочник, null и неизвестный код дают fallback', async () =>
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
    expect(keys()).toEqual(['settings', 'start', 'E_FAIL', 'SIGN_FAILED']);
  }));

test('ErrorBoundary показывает локальный STATUS и возвращает к рабочему экрану по BACK', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const { keys } = route({
    settings: [{ data: settings }],
    start: [{ data: settingProcess }],
  });
  let process!: ReturnType<typeof useProcess>;

  function BrokenScreen(): never {
    throw new Error('Синтетическая ошибка рендера');
  }

  function Probe({ fail }: { fail: boolean }) {
    process = useProcess('synthetic-id');
    const { state, commands } = process;
    return createElement(ProcessErrorBoundary, {
      onError: commands.recoverFromRenderError,
      onRetry: () => void commands.back(),
      children: fail
        ? createElement(BrokenScreen)
        : createElement('p', null, state.screen.process),
    });
  }

  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(createElement(Probe, { fail: false }));
  });
  renderers.add(tree);
  await act(async () => {
    await process.commands.start();
  });
  expect(process.state.screen).toEqual(settingProcess);
  act(() => tree.update(createElement(Probe, { fail: true })));
  expect(process.state.screen).toEqual(localFallback);
  expect(tree.root.findByType('h1').children).toEqual([
    localFallback.screen.title,
  ]);
  act(() => tree.update(createElement(Probe, { fail: false })));
  act(() => tree.root.findByType('button').props.onClick());
  expect(process.state.screen).toEqual(settingProcess);
  expect(tree.root.findByType('p').children).toEqual(['SETTING']);
  expect(keys()).toEqual(['settings', 'start']);
});

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
      await process.commands.checkSetting();
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
      // Таймер срока сессии продолжает работать независимо от STATUS.
      expect(jest.getTimerCount()).toBe(1);
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
    const process = makeProcess('old', {
      has: () => cache.promise,
      save: jest.fn(),
    });
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

test('CHECK подписывает по клику и повторяет multipart при 429/504 в пределах бюджета', async () =>
  act(async () => {
    const { requests, keys, sessions } = route({
      settings: [{ data: settings }],
      start: [{ data: settingProcess }],
      ready: [{ data: checkProcess }],
      check: [{ status: 429 }, { status: 504 }, { data: task }],
      status: [{ data: checkProcess }],
    });
    const process = makeProcess('synthetic-id', {
      has: () => true,
      save: jest.fn(),
    });
    await Promise.resolve();
    await process.commands.start();
    expect(sign).not.toHaveBeenCalled();
    await process.commands.submitCheck('ABSENT');
    expect(sign).not.toHaveBeenCalled();
    const pendingSignature = deferred<typeof signedHash>();
    sign.mockReturnValueOnce(pendingSignature.promise);
    const submit = process.commands.submitCheck('SYNTHETIC');
    await process.commands.submitCheck('SYNTHETIC');
    expect(process.snapshot().signaturePhase).toBe('signing');
    expect(keys()).toEqual(['settings', 'start', 'ready']);
    pendingSignature.resolve(signedHash);
    await jest.advanceTimersByTimeAsync(0);
    expect(process.snapshot().signaturePhase).toBe('sending');
    await jest.runAllTimersAsync();
    await submit;
    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledWith(
      {
        mode: checkProcess.cryptopro,
        thumbprint: 'SYNTHETIC',
        filters: undefined,
        hashes: checkProcess.screen.test_document,
        parameters: { profile: 'PKCS7' },
      },
      expect.any(AbortSignal),
    );
    const forms = requests
      .filter(({ key }) => key === 'check')
      .map(({ config }) => config.data as FormData);
    expect(forms).toHaveLength(3);
    expect(
      requests
        .filter(({ key }) => key === 'check')
        .every(({ config }) => !config.headers.has('X-integrity-token')),
    ).toBe(true);
    expect(sessions('check')).toEqual(Array(3).fill(settingProcess.session));
    const json = await (forms[0].get('request') as File).text();
    expect(JSON.parse(json)).toMatchObject({
      test_document: checkProcess.screen.test_document,
      certificates: [
        {
          person: signedCertificate.person,
          organization: signedCertificate.organization,
          issuer: signedCertificate.issuer,
        },
      ],
    });
    expect(json).not.toMatch(/certificate_base64|signatures|YWJj|Y2VydA/);
    for (const form of forms) {
      expect(await (form.get('request') as File).text()).toBe(json);
      const file = form.get('signatures') as File;
      expect(file.name).toBe('test.sig');
      expect(file.type).toBe('application/pkcs7-signature');
      expect(await file.text()).toBe('abc');
      const certificate = form.get('certificates') as File;
      expect(certificate.name).toBe('01.b64');
      expect(certificate.type).toBe('text/plain');
      expect(await certificate.text()).toBe(
        signedCertificate.certificate_base64,
      );
    }
    expect(keys()).toEqual([
      'settings',
      'start',
      'ready',
      'check',
      'check',
      'check',
      'status',
    ]);
    expect(certificates).toHaveBeenCalledTimes(2);
    expect(process.snapshot().screen).toEqual(checkProcess);
  }));

test.each([{ code: 'ETIMEDOUT' }, { data: { process: 'UNKNOWN' } }])(
  'CHECK открывает RESPONSE_ERROR после ошибки отправки или ответа: %j',
  async (reply) =>
    act(async () => {
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: checkProcess }],
        check: [reply],
        RESPONSE_ERROR: [{ data: dictionaryStatus }],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      await process.commands.submitCheck('SYNTHETIC');
      expect(keys()).toEqual(['settings', 'start', 'check', 'RESPONSE_ERROR']);
      expect(process.snapshot().errorKey).toBe('RESPONSE_ERROR');
      await process.commands.back();
      expect(process.snapshot().screen).toEqual(checkProcess);
      expect(sign).toHaveBeenCalledTimes(1);
    }),
);

test.each([
  ['NO_CERT', 'NO_CERT'],
  ['0x80004005', 'SIGN_FAILED'],
  ['unknown', undefined],
] as const)(
  'CHECK обрабатывает ошибку подписи %s и обновляет выборку по BACK',
  async (code, key) =>
    act(async () => {
      const filtered = {
        ...checkProcess,
        cryptopro: {
          ...checkProcess.cryptopro,
          filters: { person: { inn: 'test-filter' } },
        },
      };
      const nextCertificate = {
        ...syntheticCertificates[0],
        thumbprint: 'REPLACEMENT',
      };
      certificates
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(syntheticCertificates)
        .mockResolvedValueOnce([nextCertificate]);
      sign.mockRejectedValueOnce(new CryptoProError('signing', code));
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: filtered }],
        NO_CERT: [{ data: dictionaryStatus }, { data: dictionaryStatus }],
        SIGN_FAILED: [{ data: dictionaryStatus }],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      expect(process.snapshot().errorKey).toBe('NO_CERT');
      await process.commands.back();
      await process.commands.submitCheck('SYNTHETIC');
      expect(process.snapshot().errorKey).toBe(key);
      expect(process.snapshot().screen).toEqual(
        key ? dictionaryStatus : localFallback,
      );
      await process.commands.back();
      expect(certificates.mock.calls).toEqual(
        Array.from({ length: 3 }, () => [filtered.cryptopro.filters]),
      );
      expect(process.snapshot().signatureCertificates).toEqual([
        nextCertificate,
      ]);
      await process.commands.submitCheck('SYNTHETIC');
      expect(sign).toHaveBeenCalledTimes(1);
      expect(keys()).toEqual([
        'settings',
        'start',
        'NO_CERT',
        ...(key ? [key] : []),
      ]);
    }),
);

test.each(['back', 'unmount'] as const)(
  'CHECK игнорирует позднюю подпись после %s',
  async (action) =>
    act(async () => {
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: checkProcess }],
      });
      const process = makeProcess('old');
      await Promise.resolve();
      const signed = deferred<typeof signedHash>();
      sign.mockReturnValueOnce(signed.promise);
      await process.commands.start();
      const submit = process.commands.submitCheck('SYNTHETIC');
      if (action === 'back') await process.commands.back();
      else process.unmount();
      signed.resolve(signedHash);
      await submit;
      expect(sign).toHaveBeenCalledTimes(1);
      expect(keys()).toEqual(['settings', 'start']);
    }),
);

test.each(Object.entries(unsupportedSigningProcesses))(
  'CHECK отклоняет неподдерживаемый режим %s до поиска и подписи',
  async (_mode, response) =>
    act(async () => {
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: { ...checkProcess, cryptopro: response.cryptopro } }],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      expect(process.snapshot().screen).toEqual(localFallback);
      expect(certificates).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
      expect(keys()).toEqual(['settings', 'start']);
    }),
);

test.each([
  { ...checkProcess, cryptopro: undefined },
  {
    ...checkProcess,
    cryptopro: { ...checkProcess.cryptopro, tsp_address: ' ' },
  },
  {
    ...checkProcess,
    screen: {
      ...checkProcess.screen,
      test_document: {
        ...checkProcess.screen.test_document,
        hash512: 'invalid',
      },
    },
  },
])('CHECK отклоняет неполные данные подписи до поиска', async (data) =>
  act(async () => {
    const { keys } = route({
      settings: [{ data: settings }],
      start: [{ data, requestId: 'invalid-check' }],
      RESPONSE_ERROR: [{ data: dictionaryStatus }],
    });
    const process = makeProcess();
    await Promise.resolve();
    await process.commands.start();
    expect(process.snapshot()).toMatchObject({
      errorKey: 'RESPONSE_ERROR',
      requestId: 'invalid-check',
    });
    expect(certificates).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(keys()).toEqual(['settings', 'start', 'RESPONSE_ERROR']);
  }),
);

test('SIGNING отправляет готовые файлы повторно при 429/504 и применяет новую группу после polling', async () =>
  act(async () => {
    const next = {
      ...signingProcess,
      token: 'next-token',
      cryptopro: {
        ...signingProcess.cryptopro,
        filters: { organization: { inn: '00' } },
      },
      screen: {
        ...signingProcess.screen,
        lists: { documents: [signingProcess.screen.lists.documents[1]] },
      },
    };
    const { requests, keys } = route({
      settings: [{ data: settings }],
      start: [{ data: signingProcess }],
      signing: [
        { status: 429 },
        { status: 504 },
        { data: task },
        { data: successStatus },
      ],
      status: [{ data: next }],
    });
    const process = makeProcess();
    await Promise.resolve();
    await process.commands.start();
    expect(signDocuments).not.toHaveBeenCalled();
    await process.commands.submitSigning('ABSENT');
    expect(signDocuments).not.toHaveBeenCalled();
    const pending = deferred<{
      signatures: string[];
      certificate: typeof signedCertificate;
    }>();
    signDocuments.mockReturnValueOnce(pending.promise);
    const submit = process.commands.submitSigning('SYNTHETIC');
    await process.commands.submitSigning('SYNTHETIC');
    expect(process.snapshot().signaturePhase).toBe('signing');
    expect(keys()).toEqual(['settings', 'start']);
    pending.resolve({
      signatures: ['YQ==', 'Yg=='],
      certificate: signedCertificate,
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(process.snapshot().signaturePhase).toBe('sending');
    await jest.runAllTimersAsync();
    await submit;
    expect(signDocuments).toHaveBeenCalledTimes(1);
    expect(signDocuments).toHaveBeenCalledWith(
      {
        mode: signingProcess.cryptopro,
        thumbprint: 'SYNTHETIC',
        filters: undefined,
        parameters: { profile: 'PKCS7' },
      },
      signingProcess.screen.lists.documents,
      expect.any(AbortSignal),
    );
    const forms = requests
      .filter(({ key }) => key === 'signing')
      .map(({ config }) => config.data as FormData);
    expect(forms).toHaveLength(3);
    expect(
      requests
        .filter(({ key }) => key === 'signing')
        .map(({ config }) => config.headers.get('X-integrity-token')),
    ).toEqual(Array(3).fill(signingProcess.token));
    const json = await (forms[0].get('request') as File).text();
    const { certificate_base64, ...metadata } = signedCertificate;
    expect(JSON.parse(json)).toMatchObject({
      documents: signingProcess.screen.lists.documents,
      certificates: [metadata],
    });
    expect(json).not.toMatch(/certificate_base64|signatures/);
    for (const form of forms) {
      expect(await (form.get('request') as File).text()).toBe(json);
      const files = form.getAll('signatures') as File[];
      expect(files.map(({ name, type }) => [name, type])).toEqual(
        ['doc-1.sig', 'doc-2.sig'].map((name) => [
          name,
          'application/pkcs7-signature',
        ]),
      );
      expect(await Promise.all(files.map((file) => file.text()))).toEqual([
        'a',
        'b',
      ]);
      const certs = form.getAll('certificates') as File[];
      expect(certs.map(({ name }) => name)).toEqual(['01.b64']);
      expect(await certs[0].text()).toBe(certificate_base64);
    }
    expect(process.displayed).toContain('WAITING');
    expect(process.snapshot()).toMatchObject({
      screen: next,
      token: next.token,
    });
    expect(plugin).toHaveBeenCalledTimes(2);
    expect(csp).toHaveBeenCalledTimes(2);
    expect(certificates.mock.calls).toEqual([[], [next.cryptopro.filters]]);
    await process.commands.submitSigning('SYNTHETIC');
    expect(signDocuments.mock.calls[1][1]).toEqual(next.screen.lists.documents);
    expect(process.snapshot().screen).toEqual(successStatus);
    expect(
      requests
        .filter(({ key }) => key === 'signing')
        .at(-1)
        ?.config.headers.get('X-integrity-token'),
    ).toBe(next.token);
  }));

test.each([
  ...Object.values(unsupportedSigningProcesses),
  {
    ...signingProcess,
    cryptopro: { ...signingProcess.cryptopro, sign_type: 'unknown' },
  },
])(
  'SIGNING направляет режим $cryptopro в локальный fallback до проверки рабочего места',
  async (data) =>
    act(async () => {
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data }],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      expect(process.snapshot().screen).toEqual(localFallback);
      expect(plugin).not.toHaveBeenCalled();
      expect(csp).not.toHaveBeenCalled();
      expect(certificates).not.toHaveBeenCalled();
      expect(signDocuments).not.toHaveBeenCalled();
      expect(keys()).toEqual(['settings', 'start']);
    }),
);

test.each([undefined, 'NO_CERT', '0x80004005', 'ETIMEDOUT'])(
  'SIGNING обрабатывает отказ %s, BACK только обновляет выборку',
  async (code) =>
    act(async () => {
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: signingProcess }],
        NO_CERT: [{ data: dictionaryStatus }],
        SIGN_FAILED: [{ data: dictionaryStatus }],
        RESPONSE_ERROR: [{ data: dictionaryStatus }],
        signing: [{ code: 'ETIMEDOUT' }],
      });
      const process = makeProcess();
      await Promise.resolve();
      if (!code) certificates.mockResolvedValueOnce([]);
      await process.commands.start();
      if (code === 'NO_CERT' || code === '0x80004005') {
        signDocuments.mockRejectedValueOnce(
          new CryptoProError('signing', code),
        );
      }
      await process.commands.submitSigning('SYNTHETIC');
      expect(process.snapshot().screen).toEqual(dictionaryStatus);
      await process.commands.back();
      expect(process.snapshot().screen).toEqual(signingProcess);
      expect(certificates).toHaveBeenCalledTimes(2);
      expect(signDocuments).toHaveBeenCalledTimes(code ? 1 : 0);
      expect(keys()).toEqual([
        'settings',
        'start',
        ...(code === 'ETIMEDOUT'
          ? ['signing', 'RESPONSE_ERROR']
          : code === '0x80004005'
            ? ['SIGN_FAILED']
            : ['NO_CERT']),
      ]);
    }),
);

test.each(['подпись', 'ответ REST.01'])(
  'SIGNING игнорирует сценарий после BACK: %s',
  async (stage) =>
    act(async () => {
      const result = deferred<Reply>();
      const signature = deferred<{
        signatures: string[];
        certificate: typeof signedCertificate;
      }>();
      const { keys } = route({
        settings: [{ data: settings }],
        start: [{ data: signingProcess }],
        signing: [result.promise],
      });
      const process = makeProcess();
      await Promise.resolve();
      await process.commands.start();
      if (stage === 'подпись')
        signDocuments.mockReturnValueOnce(signature.promise);
      const submit = process.commands.submitSigning('SYNTHETIC');
      await jest.advanceTimersByTimeAsync(0);
      await process.commands.back();
      signature.resolve({
        signatures: ['YQ==', 'Yg=='],
        certificate: signedCertificate,
      });
      result.resolve({ data: successStatus });
      await submit;
      expect(signDocuments.mock.calls[0][2]?.aborted).toBe(true);
      expect(process.snapshot().screen).toEqual(signingProcess);
      expect(keys()).toEqual([
        'settings',
        'start',
        ...(stage === 'подпись' ? [] : ['signing']),
      ]);
    }),
);

test('сохранённая сессия используется на START и удаляется до повторного запроса документа после TTL', async () =>
  act(async () => {
    sessionStorage.save('restored-session');
    const { requests, sessions } = route({
      settings: [{ data: { ...settings, retry_time: 10, retry_addition: 0 } }],
      start: [{ data: signingProcess }],
      document: [{ status: 429 }, { status: 400 }],
      RESPONSE_DOC_DOWNLOAD_ERROR: [{ data: dictionaryStatus }],
    });
    const process = makeProcess();
    await Promise.resolve();
    await process.commands.start();
    expect(sessions('settings')).toEqual(['restored-session']);
    expect(sessions('start')).toEqual(['restored-session']);
    await jest.advanceTimersByTimeAsync(sessionTtl - 5);
    const download = process.commands.downloadDocument('doc-1');
    await jest.advanceTimersByTimeAsync(10);
    await download;
    expect(sessions('document')).toEqual(['restored-session', null]);
    expect(
      requests
        .filter(({ key }) => key === 'document')
        .map(({ config }) => config.headers.get('X-integrity-token')),
    ).toEqual([signingProcess.token, signingProcess.token]);
    expect(sessionStorage.read()).toBeUndefined();
  }));
