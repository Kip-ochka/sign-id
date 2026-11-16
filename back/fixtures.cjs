/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone package uses CommonJS. */

const { Buffer } = require('node:buffer');
const { randomUUID } = require('node:crypto');

const settings = {
  retry_time: 100,
  retry_addition: 0,
  retry_count: 3,
  pull_time: 700,
};

const cryptopro = {
  tsp_address: 'https://example.test/tsp',
  sign_type: 'single',
  sign_format: 'other',
  sign_position: 'detached',
};

function settingScreen(session) {
  return {
    process: 'SETTING',
    session,
    screen: {
      title: 'Настройка рабочего места',
      message: 'Проверьте расширение, КриптоПро CSP и сертификат.',
      lists: {
        testing: Object.entries({
          extension: 'Расширение браузера',
          program: 'КриптоПро CSP',
          certificate: 'Сертификат',
        }).map(([name, message]) => ({
          name,
          state: 'WAIT',
          message,
          description: `Проверка: ${message}`,
          text_button: 'Подробнее',
        })),
      },
      buttons: {
        accent: { message: 'Запустить проверку', process: 'SETTING' },
      },
    },
  };
}

function hashes(value) {
  return { hash256: value.repeat(64), hash512: value.repeat(128) };
}

const testDocument = { format: 'PDF', ...hashes('a') };
const checkScreen = {
  process: 'CHECK',
  screen: {
    title: 'Тестовая подпись',
    message: 'Выберите сертификат и подпишите тестовые данные.',
    consent: {
      text: 'Нажимая кнопку, вы принимаете условия проверки.',
      hypertext: 'Условия проверки',
      url: 'https://example.test/consent',
    },
    test_document: testDocument,
    buttons: {
      accent: { message: 'Подписать тестовые данные', process: 'CHECK' },
    },
  },
  cryptopro,
};

function minimalPdf() {
  const content = 'BT /F1 16 Tf 20 45 Td (Synthetic signing document) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 260 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  return Buffer.from(
    pdf +
      `xref\n0 6\n0000000000 65535 f \n${offsets.join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`,
  );
}

const groups = [
  [
    {
      dto: {
        id: 'agreement',
        title: 'Тестовое соглашение',
        format: 'PDF',
        ...hashes('b'),
      },
      file: minimalPdf(),
    },
    {
      dto: {
        id: 'details',
        title: 'Данные заявки',
        format: 'json',
        ...hashes('c'),
      },
      file: Buffer.from('{"synthetic":true}\n'),
    },
  ],
  [
    {
      dto: {
        id: 'receipt',
        title: 'Подтверждение',
        format: 'txt',
        ...hashes('d'),
      },
      file: Buffer.from('Synthetic signing receipt\n'),
    },
  ],
];

function signingScreen({ group, token }) {
  return {
    process: 'SIGNING',
    token,
    screen: {
      title: 'Подписание документов',
      message: 'Просмотрите документы и подпишите их одним сертификатом.',
      step: `${group + 1} из ${groups.length}`,
      lists: { documents: groups[group].map(({ dto }) => dto) },
      buttons: { accent: { message: 'Подписать', process: 'SIGNING' } },
    },
    cryptopro,
  };
}

const successScreen = {
  process: 'STATUS',
  screen: {
    level: 'SUCCESS',
    title: 'Документы подписаны',
    message: 'Моковый сервер принял все комплекты документов.',
    buttons: {
      accent: { message: 'Завершить', url: 'https://example.test/complete' },
    },
  },
};

const errorMessages = new Map([
  ['NO_CERT', 'Подходящий сертификат отсутствует.'],
  ['RESPONSE_ERROR', 'Получена ошибка при обработке заявки.'],
  ['RESPONSE_DOC_DOWNLOAD_ERROR', 'Не удалось получить документ.'],
  ['SERVICE_UNAVAL', 'Сервис временно недоступен.'],
]);

function errorScreen(key) {
  return {
    process: 'STATUS',
    screen: {
      level: 'WARNING',
      title: 'Не удалось продолжить',
      message: errorMessages.get(key) ?? 'Попробуйте повторить действие.',
      buttons: { accent: { message: 'Назад', process: 'BACK' } },
    },
  };
}

function documentResponse({ dto, file }) {
  const boundary = `signing-mock-${randomUUID()}`;
  const metadata = {
    document_id: dto.id,
    title: dto.title,
    format: dto.format,
  };
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="response"',
    'Content-Type: application/json',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"',
    'Content-Type: text/plain',
    '',
    file.toString('base64'),
    `--${boundary}--`,
    '',
  ];
  return {
    type: `multipart/mixed; boundary=${boundary}`,
    body: Buffer.from(parts.join('\r\n')),
  };
}

module.exports = {
  settings,
  settingScreen,
  checkScreen,
  testDocument,
  groups,
  signingScreen,
  successScreen,
  errorScreen,
  documentResponse,
};
