/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone package uses CommonJS. */

const { Buffer } = require('node:buffer');
const { error: logError, log } = require('node:console');
const { randomUUID } = require('node:crypto');
const process = require('node:process');
const busboy = require('busboy');
const express = require('express');
const { z } = require('zod');
const contract = require('./contract.cjs');
const fixtures = require('./fixtures.cjs');

const api = '/proxy/services/corp-digital-id-sign/api/public/v1';
const properties =
  '/proxy/services/sbercraft-dict-ext/serviceProperties/corp-digital-id-sign';

class InvalidRequest extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function validate(res, schema, input) {
  const result = schema.safeParse(input);
  res.locals.valid = result.success;
  if (!result.success) throw result.error;
  return result.data;
}

function decodeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidRequest('Invalid JSON');
  }
}

function readJson(req, res, schema) {
  if (!req.is('application/json')) {
    throw new InvalidRequest('Expected application/json', 415);
  }
  const body = decodeJson(req.body?.toString('utf8') ?? '');
  res.locals.body = body;
  return validate(res, schema, body);
}

function parseParts(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    const parser = busboy({
      headers: req.headers,
      defParamCharset: 'utf8',
      preservePath: true,
      limits: { fieldSize: 8 * 1024 * 1024 },
    });
    parser.on('field', (field, value, info) => {
      if (info.valueTruncated || info.nameTruncated) {
        reject(new InvalidRequest('Truncated multipart field'));
        return;
      }
      parts.push({
        field,
        name: '',
        mime: info.mimeType,
        data: Buffer.from(value),
      });
    });
    parser.on('file', (field, stream, { filename, mimeType }) => {
      const part = { field, name: filename ?? '', mime: mimeType };
      parts.push(part);
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        part.data = Buffer.concat(chunks);
      });
      stream.on('error', reject);
    });
    parser.on('error', reject);
    parser.on('close', () => resolve(parts));
    parser.end(req.body);
  });
}

async function readUpload(req, res, event) {
  if (!req.is('multipart/form-data')) {
    throw new InvalidRequest('Expected multipart/form-data', 415);
  }
  let parts;
  try {
    parts = await parseParts(req);
  } catch {
    throw new InvalidRequest('Invalid multipart body or boundary');
  }

  const requestText = parts
    .find(({ field }) => field === 'request')
    ?.data.toString('utf8');
  const body = {
    request: requestText ?? null,
    parts: parts.map(({ field, name, mime, data }) => ({
      field,
      name,
      mime,
      bytes: data.length,
      ...(field === 'signatures'
        ? { base64: data.toString('base64') }
        : { text: data.toString('utf8') }),
    })),
  };
  res.locals.body = body;
  body.request = decodeJson(requestText ?? '');
  return validate(res, contract.signedRequest(event), {
    request: body.request,
    parts,
  }).request;
}

function createApp({ redirectTask = false, logger = log } = {}) {
  const app = express();
  const runs = new Map();
  app.disable('x-powered-by');
  app.set('case sensitive routing', true);

  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.set({
      'X-Request-Id': requestId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Request-Id',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.locals.valid = false;
    res.once('finish', () => {
      logger(
        JSON.stringify({
          requestId,
          method: req.method,
          route: req.route?.path ?? req.path,
          url: req.originalUrl,
          body:
            res.locals.body ??
            (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null),
          valid: res.locals.valid,
          status: res.statusCode,
          issues: res.locals.issues ?? [],
        }),
      );
    });
    next();
  });

  app.options(/.*/, (req, res) => {
    res.locals.valid = true;
    res.sendStatus(204);
  });
  app.use(express.raw({ type: () => true, limit: '8mb' }));

  function getRun(inquiryId, stage) {
    const run = runs.get(inquiryId);
    if (!run) throw new InvalidRequest('Start this inquiry first', 401);
    if (run.stage !== stage) throw new InvalidRequest(`Expected step ${stage}`);
    return run;
  }

  app.get(`${properties}/:key`, (req, res) => {
    const key = validate(res, contract.nonBlank, req.params.key);
    res.json(
      key === 'settings' ? fixtures.settings : fixtures.errorScreen(key),
    );
  });

  app.post(`${api}/state/start`, (req, res) => {
    const { inquiry_id } = readJson(req, res, contract.base);
    const session = randomUUID();
    runs.set(inquiry_id, { stage: 'SETTING' });
    res.json(fixtures.settingScreen(session));
  });

  app.post(`${api}/state/ready`, (req, res) => {
    const { inquiry_id } = readJson(req, res, contract.base);
    const run = getRun(inquiry_id, 'SETTING');
    run.stage = 'CHECK';
    res.json(fixtures.checkScreen);
  });

  app.post(`${api}/state/check`, async (req, res) => {
    const body = await readUpload(req, res, 'check');
    const run = getRun(body.inquiry_id, 'CHECK');
    validate(
      res,
      contract.matchesIssued(fixtures.testDocument),
      body.test_document,
    );
    run.stage = 'WAITING';
    run.task = randomUUID();
    run.nextTask = randomUUID();
    if (redirectTask) {
      res.location(
        `${api}/task/${encodeURIComponent(body.inquiry_id)}/${run.task}`,
      );
    }
    res.status(303).json({ task: run.task });
  });

  app.get(`${api}/task/:inquiry/:task`, (req, res) => {
    const { inquiry, task } = validate(
      res,
      z.object({
        inquiry: contract.nonBlank,
        task: contract.nonBlank,
      }),
      req.params,
    );
    const run = getRun(inquiry, 'WAITING');
    validate(res, z.literal(run.task), task);
    res.json({ task });
  });

  app.post(`${api}/poll/status`, (req, res) => {
    const { inquiry_id, task } = readJson(req, res, contract.pollRequest);
    const run = getRun(inquiry_id, 'WAITING');
    validate(res, z.literal([run.task, run.nextTask]), task);
    if (task === run.task) return res.json({ task: run.nextTask });
    run.stage = 'SIGNING';
    run.group = 0;
    run.token = randomUUID();
    return res.json(fixtures.signingScreen(run));
  });

  app.post(`${api}/document`, (req, res) => {
    const { inquiry_id, document_id } = readJson(
      req,
      res,
      contract.documentRequest,
    );
    const run = getRun(inquiry_id, 'SIGNING');
    const documents = fixtures.groups[run.group];
    validate(res, z.literal(documents.map(({ dto }) => dto.id)), document_id);
    const response = fixtures.documentResponse(
      documents.find(({ dto }) => dto.id === document_id),
    );
    res.type(response.type).send(response.body);
  });

  app.post(`${api}/state/signing`, async (req, res) => {
    const body = await readUpload(req, res, 'signing');
    const run = getRun(body.inquiry_id, 'SIGNING');
    const expected = fixtures.groups[run.group].map(({ dto }) => dto);
    validate(res, contract.matchesIssued(expected), body.documents);
    run.group += 1;
    if (run.group < fixtures.groups.length) {
      run.token = randomUUID();
      return res.json(fixtures.signingScreen(run));
    }
    run.stage = 'STATUS';
    return res.json(fixtures.successScreen);
  });

  app.use((req, res) => {
    res.locals.issues = [{ message: 'Unknown method or route' }];
    res.status(404).json({ error: 'Unknown method or route' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = 400;
    let issues;
    if (error instanceof z.ZodError) {
      issues = error.issues;
    } else if (
      error instanceof InvalidRequest ||
      (error.status >= 400 && error.status < 500)
    ) {
      status = error.status;
      issues = [{ message: error.message }];
    } else {
      status = 500;
      issues = [{ message: 'Internal mock server error' }];
      logError(error);
    }
    res.locals.issues = issues;
    return res.status(status).json({ error: issues[0].message, issues });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.MOCK_PORT ?? '3001');
  createApp({ redirectTask: process.env.MOCK_303_LOCATION === '1' }).listen(
    port,
    '127.0.0.1',
    () => {
      log(`SIGNING mock server: http://127.0.0.1:${port}`);
    },
  );
}

module.exports = { createApp };
