import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createSettingCache } from './settingCache';

const checkedAt = Date.UTC(2026, 0, 1);
const ttl = 24 * 60 * 60 * 1000;
const stages = ['extension', 'program', 'certificate'] as const;
const record = {
  version: 2,
  inquiry_id: 'inquiry',
  device: 'synthetic-device',
  checked_at: checkedAt,
  stages,
};

beforeEach(() => {
  jest.useFakeTimers({ now: checkedAt });
});
afterEach(() => {
  jest.useRealTimers();
});

test.each([
  [0, true],
  [ttl - 1, true],
  [ttl, false],
  [ttl + 1, false],
  [-1, false],
])('возраст %d мс: кэш действителен = %s', (age, valid) => {
  jest.setSystemTime(checkedAt + age);
  const cache = createSettingCache(
    () => record.device,
    () => ({
      getItem: () => JSON.stringify(record),
      setItem: jest.fn(),
    }),
  );
  expect(cache.has(record.inquiry_id)).toBe(valid);
});

test.each([
  null,
  'broken JSON',
  'null',
  JSON.stringify({ ...record, version: 3 }),
  JSON.stringify({ ...record, stages: 'extension' }),
  JSON.stringify({ ...record, stages: ['extension', 'certificate'] }),
  JSON.stringify({ ...record, checked_at: String(checkedAt) }),
  JSON.stringify({ ...record, checked_at: checkedAt + 0.5 }),
  JSON.stringify({ ...record, device: 'another-device' }),
  JSON.stringify({ ...record, inquiry_id: 'another-inquiry' }),
])('запись %s даёт промах', (raw) => {
  const cache = createSettingCache(
    () => record.device,
    () => ({
      getItem: () => raw,
      setItem: jest.fn(),
    }),
  );
  expect(cache.has(record.inquiry_id)).toBe(false);
});

test('кэш сохраняет полный набор проверок для текущей заявки', () => {
  const entries = new Map<string, string>([['digitalid_sign_inq', 'legacy']]);
  const cache = createSettingCache(
    () => record.device,
    () => ({
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    }),
  );
  cache.save(record.inquiry_id);
  expect(JSON.parse(entries.get('digital_id_sign')!)).toEqual(record);
  expect(cache.has(record.inquiry_id)).toBe(true);
  expect(cache.has('legacy')).toBe(false);
  expect(cache.has('')).toBe(false);
});

test('валидная запись версии 1 покрывает все три этапа', () => {
  const cache = createSettingCache(
    () => record.device,
    () => ({
      getItem: () =>
        JSON.stringify({
          version: 1,
          inquiry_id: record.inquiry_id,
          device: record.device,
          checked_at: checkedAt,
        }),
      setItem: jest.fn(),
    }),
  );
  expect(cache.has(record.inquiry_id)).toBe(true);
});

test('без идентификатора устройства localStorage не используется', () => {
  const storage = jest.fn(() => ({
    getItem: jest.fn<() => string>(),
    setItem: jest.fn(),
  }));
  const cache = createSettingCache(undefined, storage);
  expect(cache.has(record.inquiry_id)).toBe(false);
  cache.save(record.inquiry_id);
  expect(storage).not.toHaveBeenCalled();
});

test('запрет доступа к localStorage даёт промах и безопасный отказ записи', () => {
  const cache = createSettingCache(
    () => record.device,
    () => {
      throw new Error('Storage unavailable');
    },
  );
  expect(cache.has(record.inquiry_id)).toBe(false);
  expect(() => cache.save(record.inquiry_id)).not.toThrow();
});
