import { expect, test } from '@jest/globals';

import {
  getHttpAttemptLimit,
  getUnauthorizedAction,
  localFallback,
  parseProcessResult,
  pollStatusResponseSchema,
  screenResponseSchema,
  settingsResponseSchema,
  stateResponseSchema,
} from '..';
import { readInquiryId } from '../../readInquiryId';
import {
  checkProcess,
  settingProcess,
  settings,
  signingProcess,
  statusProcess,
  task,
  unsupportedSigningProcesses,
} from './fixtures';

test.each([settingProcess, checkProcess, signingProcess, statusProcess])(
  'принимает $process целиком, сохраняя поля экрана',
  (response) => {
    expect(parseProcessResult(response)).toEqual({
      success: true,
      data: { kind: 'process', response },
    });
  },
);

test('принимает task отдельно от DTO процесса', () => {
  expect(parseProcessResult(task)).toEqual({
    success: true,
    data: { kind: 'task', response: task },
  });
});

test.each([
  ['пустой task', { task: '  ' }],
  ['task вместе с процессом', { ...task, ...statusProcess }],
  ['неизвестный процесс', { ...statusProcess, process: 'WAITING' }],
  [
    'неверный тип step',
    { ...signingProcess, screen: { ...signingProcess.screen, step: 1 } },
  ],
  [
    'неверный hash256 одного из документов',
    {
      ...signingProcess,
      screen: {
        ...signingProcess.screen,
        lists: {
          documents: [
            signingProcess.screen.lists.documents[0],
            { ...signingProcess.screen.lists.documents[1], hash256: 'bad' },
          ],
        },
      },
    },
  ],
])('отклоняет %s без частичного DTO', (_name, response) => {
  expect(parseProcessResult(response).success).toBe(false);
  expect(stateResponseSchema.safeParse(response).success).toBe(false);
  expect(pollStatusResponseSchema.safeParse(response).success).toBe(false);
});

test.each(Object.entries(unsupportedSigningProcesses))(
  'маршрутизирует %s в локальный fallback',
  (_name, response) => {
    expect(stateResponseSchema.parse(response)).toEqual(response);
    const { cryptopro } = response;
    const { sign_type, sign_format, sign_position } = cryptopro;
    const expected = {
      success: true,
      data: {
        kind: 'unsupported-mode',
        mode: { sign_type, sign_format, sign_position },
        fallback: localFallback,
      },
    };
    expect(parseProcessResult(response)).toEqual(expected);
    expect(
      parseProcessResult({ process: 'CHECK', cryptopro, screen: {} }),
    ).toEqual(expected);
  },
);

test.each([
  { ...signingProcess, cryptopro: undefined },
  {
    ...signingProcess,
    cryptopro: { ...signingProcess.cryptopro, tsp_address: ' ' },
  },
  ...[
    [],
    [
      signingProcess.screen.lists.documents[0],
      signingProcess.screen.lists.documents[0],
    ],
    [{ ...signingProcess.screen.lists.documents[0], id: ' ' }],
  ].map((documents) => ({
    ...signingProcess,
    screen: { ...signingProcess.screen, lists: { documents } },
  })),
])(
  'отклоняет SIGNING без параметров или с неоднозначным комплектом документов %#',
  (response) => {
    expect(parseProcessResult(response).success).toBe(false);
  },
);

test('локальный fallback соответствует R-27', () => {
  expect(screenResponseSchema.parse(localFallback)).toEqual({
    process: 'STATUS',
    screen: {
      level: 'WARNING',
      title: 'Что-то пошло не так',
      message: 'Пожалуйста, попробуйте повторить попытку позже',
      buttons: { accent: { message: 'Попробовать снова', process: 'BACK' } },
    },
  });
});

test.each([
  [0, 1],
  [1, 1],
  [3, 3],
])('retry_count=%i даёт бюджет %i HTTP-вызовов', (retry_count, limit) => {
  const parsed = settingsResponseSchema.parse({ ...settings, retry_count });
  expect(parsed.retry_addition).toBe(0);
  expect(getHttpAttemptLimit(parsed)).toBe(limit);
});

test('невалидное поле отклоняет весь DTO настроек', () => {
  expect(
    settingsResponseSchema.safeParse({ ...settings, retry_time: -1 }).success,
  ).toBe(false);
});

test.each([
  ['', ''],
  ['?other=synthetic-inquiry', ''],
  ['?id=', ''],
  ['?id=+%09', ''],
  ['?id=synthetic-inquiry&id=', ''],
  ['?id=synthetic-inquiry&id=synthetic-inquiry', ''],
  ['?id=%20synthetic%2Bid%20', ' synthetic+id '],
])('читает единственный непустой id из %j', (search, expected) => {
  expect(readInquiryId(search)).toBe(expected);
});

test.each([
  [false, 'START'],
  [true, 'RESPONSE_ERROR'],
])(
  'обрабатывает 401 при выполненном рестарте=%s как %s',
  (restarted, action) => {
    expect(getUnauthorizedAction(restarted)).toBe(action);
  },
);
