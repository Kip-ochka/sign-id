import { documentResponseSchema } from '../schemas';
import type { DocumentData } from '../types';

export const parseDocumentResponse = async (
  body: ArrayBuffer,
  contentType: string | null | undefined,
): Promise<DocumentData> => {
  const mixedType = /^multipart\/mixed(?=\s*;)/i;

  if (!contentType || !mixedType.test(contentType)) {
    throw new Error('Ожидался multipart/mixed с boundary');
  }

  // formData() не принимает multipart/mixed — подменяем подтип, boundary сохраняем.
  const parts = await new Response(body, {
    headers: {
      'Content-Type': contentType.replace(mixedType, 'multipart/form-data'),
    },
  }).formData();

  const jsonPart = parts.get('response');
  const filePart = parts.get('file');

  if (jsonPart === null || filePart === null) {
    throw new Error('В ответе отсутствует часть response или file');
  }
  if (
    parts.getAll('response').length !== 1 ||
    parts.getAll('file').length !== 1
  ) {
    throw new Error('В ответе повторяется часть response или file');
  }

  const jsonText =
    typeof jsonPart === 'string' ? jsonPart : await jsonPart.text();
  const base64 =
    typeof filePart === 'string' ? filePart : await filePart.text();
  const metadata: unknown = JSON.parse(jsonText);
  const parsed = documentResponseSchema.safeParse(metadata);

  if (!parsed.success) {
    throw new Error('Некорректные данные документа в части response');
  }

  return { ...parsed.data, base64 };
};
