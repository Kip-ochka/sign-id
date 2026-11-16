import type {
  CheckScreen,
  SettingScreen,
  SettingsResponse,
  SigningScreen,
  StartStateRequest,
  StatusScreen,
} from '..';

export const stateBody: StartStateRequest = {
  inquiry_id: 'synthetic-inquiry',
  req_time: '2026-01-01T12:00:00Z',
  sc_name: 'urn:front-corp-digital-id-microfront',
  sp_name: 'urn:corp-digital-id',
};

export const task = { task: 'synthetic-task' };

export const settings = {
  retry_time: 2,
  retry_addition: 0,
  retry_count: 3,
  pull_time: 5,
} satisfies SettingsResponse;

const buttons = {
  accent: { message: 'Назад', process: 'BACK' },
  secondary: { message: 'Инструкция', url: 'https://example.test/help' },
};

export const settingProcess = {
  process: 'SETTING',
  session: 'synthetic-session',
  screen: {
    title: 'Настройка рабочего места',
    message: 'Выполните проверку',
    lists: {
      testing: [
        {
          name: 'Проверка',
          state: 'WAIT',
          message: 'Ожидание',
          description: 'Проверка рабочего места',
          text_button: 'Инструкция',
        },
      ],
    },
    buttons,
  },
  cryptopro: { filters: { person: { inn: 'synthetic-inn' } } },
} satisfies SettingScreen;

export const testDocument = {
  format: 'PDF',
  hash256: 'a'.repeat(64),
  hash512: 'b'.repeat(128),
};

const singleDetached = {
  sign_type: 'single',
  sign_format: 'other',
  sign_position: 'detached',
  tsp_address: 'https://example.test/tsp',
};

export const checkProcess = {
  process: 'CHECK',
  screen: {
    title: 'Тестовая подпись',
    message: 'Выберите сертификат',
    consent: {
      text: 'Условия проверки',
      hypertext: 'Подробнее',
      url: 'https://example.test/consent',
    },
    test_document: testDocument,
    buttons,
  },
  cryptopro: singleDetached,
} satisfies CheckScreen;

export const signingProcess = {
  process: 'SIGNING',
  token: 'synthetic-token',
  screen: {
    title: 'Подписание',
    message: 'Проверьте документы',
    lists: {
      documents: [
        { ...testDocument, id: 'doc-1', title: 'Первый документ' },
        {
          ...testDocument,
          id: 'doc-2',
          title: 'Второй документ',
          hash256: 'c'.repeat(64),
          hash512: 'd'.repeat(128),
        },
      ],
    },
    buttons,
  },
  cryptopro: singleDetached,
} satisfies SigningScreen;

export const unsupportedSigningProcesses = {
  batch: {
    ...signingProcess,
    cryptopro: { ...singleDetached, sign_type: 'batch' },
  },
  archived: {
    ...signingProcess,
    cryptopro: {
      ...singleDetached,
      sign_type: 'archived',
      hash256_archived: 'e'.repeat(64),
      hash512_archived: 'f'.repeat(128),
    },
  },
  xml: {
    ...signingProcess,
    cryptopro: { ...singleDetached, sign_format: 'xml' },
  },
  attached: {
    ...signingProcess,
    cryptopro: { ...singleDetached, sign_position: 'attached' },
  },
} satisfies Record<string, SigningScreen>;

export const statusProcess = {
  process: 'STATUS',
  timer: 0,
  screen: {
    level: 'WARNING',
    title: 'Статус',
    message: 'Ожидание',
    buttons: {
      accent: {
        message: 'Продолжить',
        url: 'https://next.example.test/process?step=confirm',
      },
    },
  },
} satisfies StatusScreen;

export const documentMetadata = {
  document_id: 'doc-1',
  title: 'Документ',
  format: 'PDF',
};

export const documentBase64 = 'YWJj';
const boundary = 'signing-document-fixture';

export const documentMultipart = ({
  quotedBoundary = false,
  filenames = false,
  omit,
  json = JSON.stringify(documentMetadata),
  file = documentBase64,
}: {
  quotedBoundary?: boolean;
  filenames?: boolean;
  omit?: 'response' | 'file';
  json?: string;
  file?: string;
} = {}) => {
  const parts: [name: string, content: string][] = [
    ['response', json],
    ['file', file],
  ];
  const lines = parts
    .filter(([name]) => name !== omit)
    .flatMap(([name, content]) => [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${name}"${filenames ? `; filename="${name}.txt"` : ''}`,
      '',
      content,
    ]);

  return {
    body: new TextEncoder().encode(
      [...lines, `--${boundary}--`, ''].join('\r\n'),
    ).buffer,
    contentType: `multipart/mixed; boundary=${quotedBoundary ? `"${boundary}"` : boundary}`,
  };
};
