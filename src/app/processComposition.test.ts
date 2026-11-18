import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { AxiosHeaders } from 'axios';

import App from '../App';
import { sessionStorage } from '../entities/signing';
import { httpClient } from '../shared/api';
import {
  checkProcess,
  settingProcess,
  settings,
  signingProcess,
  statusProcess,
} from '../shared/api/__tests__/fixtures';
import {
  findCertificates,
  signHash,
  signHashes,
} from '../shared/services/cryptoPro/adapter';
import {
  checkBrowserPlugin,
  readCspVersion,
} from '../shared/services/cryptoPro/workplace';

jest.mock('../shared/services/cryptoPro/adapter', () => ({
  findCertificates: jest.fn(),
  signHash: jest.fn(),
  signHashes: jest.fn(),
}));
jest.mock('../shared/services/cryptoPro/workplace', () => ({
  checkBrowserPlugin: jest.fn(),
  readCspVersion: jest.fn(),
}));

const certificate = {
  type: 'signed' as const,
  serial_number: '01',
  thumbprint: 'SYNTHETIC',
  person: { last_name: 'Тестов', first_name: 'Иван' },
  organization: { name: 'Тестовая организация' },
  issuer: { name: 'Тестовый УЦ' },
  certificate_base64: 'Y2VydA==',
};
const originalAdapter = httpClient.defaults.adapter;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let tree: ReactTestRenderer | undefined;
let requests: string[];

beforeEach(() => {
  requests = [];
  sessionStorage.clear();
  jest.mocked(checkBrowserPlugin).mockResolvedValue(undefined);
  jest
    .mocked(readCspVersion)
    .mockResolvedValue({ major: 5, minor: 0, build: 1 });
  jest.mocked(findCertificates).mockResolvedValue([certificate]);
  jest
    .mocked(signHash)
    .mockResolvedValue({ signatureBase64: 'YWJj', certificate });
  jest.mocked(signHashes).mockImplementation(async (_input, documents) => ({
    signatures: documents.map(() => 'YWJj'),
    certificate,
  }));
  const replies: Record<string, unknown> = {
    settings,
    start: settingProcess,
    ready: checkProcess,
    check: signingProcess,
    signing: {
      ...statusProcess,
      timer: undefined,
      screen: { ...statusProcess.screen, level: 'SUCCESS', title: 'Готово' },
    },
  };
  httpClient.defaults.adapter = async (config) => {
    const key = config.url?.split('/').at(-1) ?? '';
    requests.push(key);
    if (!(key in replies)) {
      throw new Error('Неожиданный запрос ' + key);
    }
    return {
      config,
      status: 200,
      statusText: '',
      headers: new AxiosHeaders(),
      data: replies[key],
    };
  };
});

afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  sessionStorage.clear();
  httpClient.defaults.adapter = originalAdapter;
  jest.resetAllMocks();
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
});

async function render(inquiryId: string) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { search: `?id=${encodeURIComponent(inquiryId)}` },
    },
  });
  await act(async () => {
    tree = create(createElement(App));
    await new Promise((resolve) => setImmediate(resolve));
  });
}

async function clickAction(label: string) {
  const button = tree!.root
    .findAllByType('button')
    .find(({ children }) => children.includes(label));
  expect(button?.props.disabled).toBe(false);
  await act(async () => {
    button!.props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
  });
}

test('страницы и widgets проводят заявку через SETTING, CHECK и SIGNING', async () => {
  await render('synthetic-id');
  expect(tree!.root.findByType('h1').children).toEqual([
    'Настройка рабочего места',
  ]);
  await clickAction('Запустить проверку');
  expect(tree!.root.findByType('h1').children).toEqual(['Тестовая подпись']);
  await clickAction('Назад');
  expect(tree!.root.findByType('h1').children).toEqual(['Подписание']);
  await clickAction('Назад');
  expect(tree!.root.findByType('h1').children).toEqual(['Готово']);
  expect(requests).toEqual(['settings', 'start', 'ready', 'check', 'signing']);
  expect(signHash).toHaveBeenCalledTimes(1);
  expect(signHashes).toHaveBeenCalledTimes(1);
});

test('страница невалидной ссылки отображается без запуска фичей', async () => {
  await render('');
  expect(tree!.root.findByType('h1').children).toEqual([
    'Ссылка недействительна',
  ]);
  expect(requests).toEqual([]);
  expect(findCertificates).not.toHaveBeenCalled();
});

test('новый Select включает подпись только после выбора сертификата и передаёт его в команду', async () => {
  const second = { ...certificate, thumbprint: 'SECOND', serial_number: '02' };
  jest.mocked(findCertificates).mockResolvedValue([certificate, second]);
  await render('synthetic-id');
  await clickAction('Запустить проверку');
  const confirm = () =>
    tree!.root
      .findAllByType('button')
      .find(({ children }) => children.includes('Назад'))!;
  expect(confirm().props.disabled).toBe(true);
  const select = tree!.root.findByType('select');
  expect(select.props.value).toBe('');
  act(() => select.props.onChange({ target: { value: 'SECOND' } }));
  expect(confirm().props.disabled).toBe(false);
  await clickAction('Назад');
  expect(signHash).toHaveBeenCalledWith(
    expect.objectContaining({ thumbprint: 'SECOND' }),
    expect.anything(),
  );
});
