import { expect, test } from '@jest/globals';

import { createDocumentFile } from './documentFile';

test.each([
  ['PDF', '%PDF-1.7', 'application/pdf', 'pdf'],
  ['doc', 'Synthetic Word', 'application/msword', undefined],
  ['DOC', 'Synthetic Word', 'application/msword', undefined],
  ['png', '\x89PNG\r\n\x1a\n', 'image/png', 'image'],
  ['JPEG', '\xff\xd8\xff', 'image/jpeg', 'image'],
  ['svg', '<svg/>', 'image/svg+xml', undefined],
  ['HTML', '<html>', 'text/html', undefined],
  ['pdf', '<html>', 'application/pdf', undefined],
  ['png', '<html>', 'image/png', undefined],
  ['TXT', 'Synthetic text', 'text/plain', undefined],
  ['JSON', '{}', 'application/json', undefined],
  ['unknownfile', 'abc', 'application/octet-stream', undefined],
])(
  'сопоставляет %s с MIME и возможностью просмотра',
  async (format, binary, mime, kind) => {
    const result = createDocumentFile({ title: 'Документ', format, binary });
    expect(result.file.type).toBe(mime);
    expect(result.file.name).toBe('Документ.' + format.toLowerCase());
    expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
    expect(result.kind).toBe(kind);
  },
);

test.each([
  [' CON.DOC ', 'doc', '_CON.doc'],
  ['../отчёт.pdf.exe', 'PDF', '___отчёт_pdf_exe.pdf'],
  [' ', '../pdf', 'document.bin'],
])('очищает имя файла %s', (title, format, name) => {
  expect(createDocumentFile({ title, format, binary: 'abc' }).file.name).toBe(
    name,
  );
});
