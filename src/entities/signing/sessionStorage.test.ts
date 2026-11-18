import { afterEach, expect, jest, test } from '@jest/globals';
import {
  createSessionStorage,
  sessionStorageKey,
  sessionTtl,
} from './sessionStorage';

afterEach(() => {
  jest.useRealTimers();
});

test('сессия восстанавливается из localStorage, заменяется и удаляется ровно через 115 минут', () => {
  jest.useFakeTimers();
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
  const first = createSessionStorage(() => storage);
  first.save('old');
  jest.advanceTimersByTime(1000);
  const restored = createSessionStorage(() => storage);
  expect(restored.read()).toBe('old');
  restored.save('new');
  expect(entries.get(sessionStorageKey)).not.toContain('old');
  jest.advanceTimersByTime(sessionTtl - 1);
  expect(restored.read()).toBe('new');
  jest.advanceTimersByTime(1);
  expect(entries.has(sessionStorageKey)).toBe(false);
  expect(first.read()).toBeUndefined();
});

test('просроченная запись удаляется при чтении после закрытия приложения', () => {
  const removeItem = jest.fn();
  const session = createSessionStorage(() => ({
    getItem: () => JSON.stringify({ id: 'expired', expiresAt: Date.now() - 1 }),
    setItem: jest.fn(),
    removeItem,
  }));
  expect(session.read()).toBeUndefined();
  expect(removeItem).toHaveBeenCalledWith(sessionStorageKey);
});

test('при недоступной записи localStorage сессия живёт в памяти до TTL', () => {
  jest.useFakeTimers();
  const session = createSessionStorage(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error('Storage unavailable');
    },
    removeItem: jest.fn(),
  }));
  session.save('memory-session');
  expect(session.read()).toBe('memory-session');
  jest.advanceTimersByTime(sessionTtl);
  expect(session.read()).toBeUndefined();
});
