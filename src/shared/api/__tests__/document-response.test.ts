import { expect, test } from '@jest/globals';

import { parseDocumentResponse } from '..';
import {
  documentBase64,
  documentMetadata,
  documentMultipart,
} from './fixtures';

test.each([
  { quotedBoundary: false, filenames: false },
  { quotedBoundary: true, filenames: false },
  { quotedBoundary: false, filenames: true },
  { quotedBoundary: true, filenames: true },
])('разбирает multipart/mixed (%j)', async (options) => {
  const { body, contentType } = documentMultipart(options);

  await expect(parseDocumentResponse(body, contentType)).resolves.toEqual({
    ...documentMetadata,
    base64: documentBase64,
  });
});

test.each([undefined, 'application/json'])(
  'отклоняет неподходящий Content-Type (%s)',
  async (contentType) => {
    const { body } = documentMultipart();
    await expect(parseDocumentResponse(body, contentType)).rejects.toThrow(
      'Ожидался multipart/mixed с boundary',
    );
  },
);

test('отклоняет multipart/mixed без boundary', async () => {
  const { body } = documentMultipart();
  await expect(
    parseDocumentResponse(body, 'multipart/mixed; charset=utf-8'),
  ).rejects.toThrow();
});

test.each(['response', 'file'] as const)(
  'отклоняет ответ без %s',
  async (omit) => {
    const { body, contentType } = documentMultipart({ omit });
    await expect(parseDocumentResponse(body, contentType)).rejects.toThrow(
      'В ответе отсутствует часть response или file',
    );
  },
);

test('отклоняет синтаксически неверный JSON', async () => {
  const { body, contentType } = documentMultipart({ json: '{' });
  await expect(parseDocumentResponse(body, contentType)).rejects.toThrow(
    SyntaxError,
  );
});

test('проверяет метаданные документа через Zod', async () => {
  const { body, contentType } = documentMultipart({
    json: JSON.stringify({ ...documentMetadata, title: 123 }),
  });
  await expect(parseDocumentResponse(body, contentType)).rejects.toThrow(
    'Некорректные данные документа в части response',
  );
});

test('возвращает текст файла как есть', async () => {
  const file = 'не Base64';
  const { body, contentType } = documentMultipart({ file });
  await expect(parseDocumentResponse(body, contentType)).resolves.toEqual({
    ...documentMetadata,
    base64: file,
  });
});
