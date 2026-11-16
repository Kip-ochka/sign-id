/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone package uses CommonJS. */

const { Buffer } = require('node:buffer');
const { isDeepStrictEqual } = require('node:util');
const { z } = require('zod');

const nonBlank = z.string().refine((value) => value.trim().length > 0);
const base = z.strictObject({
  inquiry_id: nonBlank,
  req_time: z.iso.datetime({ offset: true }),
  sc_name: z.literal('urn:front-corp-digital-id-microfront'),
  sp_name: z.literal('urn:corp-digital-id'),
});

const testDocument = z.strictObject({
  format: z.string().regex(/^[a-z0-9]+$/i),
  hash256: z.string().regex(/^[a-f0-9]{64}$/i),
  hash512: z.string().regex(/^[a-f0-9]{128}$/i),
});
const document = testDocument.extend({ id: nonBlank, title: z.string() });
const organization = z.strictObject({
  name: z.string(),
  inn: z.string(),
  ogrn: z.string(),
});
const certificate = z.strictObject({
  type: z.literal('signed'),
  serial_number: nonBlank,
  thumbprint: nonBlank,
  expires_at: z.iso.datetime({ offset: true }),
  person: z.strictObject({
    last_name: z.string(),
    first_name: z.string(),
    middle_name: z.string(),
    inn: z.string(),
    snils: z.string(),
  }),
  organization,
  issuer: organization,
});

const check = base.extend({
  test_document: testDocument,
  certificates: z.array(certificate).length(1),
});
const signing = base.extend({
  documents: z
    .array(document)
    .nonempty()
    .refine((documents) => {
      return new Set(documents.map(({ id }) => id)).size === documents.length;
    }, 'Document ids must be unique'),
  certificates: z.array(certificate).length(1),
});

const part = z.object({
  field: z.string(),
  name: z.string(),
  mime: z.string(),
  data: z.instanceof(Buffer).refine((data) => data.length > 0),
});

function isCertificateBase64(data) {
  const value = data.toString('utf8').replace(/[\r\n]/g, '');
  return (
    value.length > 0 &&
    Buffer.from(value, 'base64').toString('base64') === value
  );
}

function signedRequest(event) {
  return z
    .object({
      request: event === 'check' ? check : signing,
      parts: z.array(part).min(3),
    })
    .superRefine(({ request, parts }, ctx) => {
      const expectedSignatures =
        event === 'check'
          ? ['test.sig']
          : request.documents.map(({ id }) => `${id}.sig`);
      const expectedCertificate = `${request.certificates[0]?.serial_number}.b64`;
      const [json, ...files] = parts;
      const publicCertificate = files.at(-1);
      const signatures = files.slice(0, -1);
      const signatureNames = new Set(signatures.map(({ name }) => name));

      if (json?.field !== 'request' || json.mime !== 'application/json') {
        ctx.addIssue({
          code: 'custom',
          path: ['parts', 0],
          message: 'The first part must be request (application/json)',
        });
      }
      if (
        signatures.length !== expectedSignatures.length ||
        expectedSignatures.some((name) => !signatureNames.has(name)) ||
        signatures.some(
          ({ field, mime }) =>
            field !== 'signatures' || mime !== 'application/pkcs7-signature',
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['parts'],
          message:
            'Expected one binary signatures part per document, before the certificate',
        });
      }
      if (
        publicCertificate?.field !== 'certificates' ||
        publicCertificate.name !== expectedCertificate ||
        publicCertificate.mime !== 'text/plain' ||
        !isCertificateBase64(publicCertificate.data)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['parts'],
          message:
            'Expected one certificates part named <serial_number>.b64 containing Base64 text',
        });
      }
    });
}

function matchesIssued(expected) {
  return z.unknown().refine((actual) => isDeepStrictEqual(actual, expected), {
    message: 'Request documents must match the documents issued for this step',
  });
}

module.exports = {
  base,
  documentRequest: base.extend({ document_id: nonBlank }),
  pollRequest: base.extend({ task: nonBlank }),
  signedRequest,
  matchesIssued,
  nonBlank,
};
