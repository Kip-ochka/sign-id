import { errorsBase } from '../../errorsBase';

type CryptoStage = 'extension' | 'plugin' | 'csp' | 'certificate' | 'signing';

const hresultPattern = /\b0x[0-9a-f]{8}\b/i;

function readHresult(value: unknown) {
  if (typeof value === 'string') {
    return value.match(hresultPattern)?.[0];
  }
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    ((value >= -0x80000000 && value < 0) ||
      (value >= 0x80000000 && value <= 0xffffffff))
  ) {
    const unsignedValue = value < 0 ? value + 2 ** 32 : value;
    return '0x' + unsignedValue.toString(16).padStart(8, '0');
  }
  return undefined;
}

function readPluginMessage(
  cause: unknown,
  getLastError: (cause: unknown) => unknown,
) {
  try {
    const result = getLastError(cause);
    return typeof result === 'string' ? result : '';
  } catch {
    // Диагностика плагина может сама завершиться ошибкой.
    return '';
  }
}

export class CryptoProError extends Error {
  readonly cause?: unknown;
  readonly sourceCode?: string;
  readonly code: string;

  constructor(
    readonly stage: CryptoStage,
    code: string,
    cause?: unknown,
    getLastError?: (cause: unknown) => unknown,
  ) {
    let originalMessage = '';
    if (typeof cause === 'string') {
      originalMessage = cause;
    } else if (
      typeof cause === 'object' &&
      cause !== null &&
      'message' in cause &&
      typeof cause.message === 'string'
    ) {
      originalMessage = cause.message;
    }
    const pluginMessage = getLastError
      ? readPluginMessage(cause, getLastError)
      : '';
    super(originalMessage || pluginMessage || code);
    this.cause = cause;
    this.name = 'CryptoProError';
    const errorFields = cause as
      { code?: unknown; number?: unknown } | undefined;
    const originalCode = errorFields?.code;
    const hresult =
      readHresult(originalCode) ??
      readHresult(errorFields?.number) ??
      readHresult(cause) ??
      readHresult(originalMessage) ??
      readHresult(pluginMessage);
    const symbolicCode =
      typeof originalCode === 'string' && originalCode
        ? originalCode
        : undefined;
    this.sourceCode =
      hresult ??
      (getLastError ? undefined : symbolicCode) ??
      (Object.prototype.hasOwnProperty.call(errorsBase, originalMessage)
        ? originalMessage
        : undefined);
    this.code =
      this.sourceCode ??
      ((getLastError && (originalMessage || pluginMessage)) ||
        symbolicCode ||
        code);
  }
}

export async function cryptoOperation<T>(
  stage: CryptoStage,
  code: string,
  operation: () => Promise<T>,
  getLastError?: (cause: unknown) => unknown,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CryptoProError) {
      throw error;
    }
    throw new CryptoProError(stage, code, error, getLastError);
  }
}
