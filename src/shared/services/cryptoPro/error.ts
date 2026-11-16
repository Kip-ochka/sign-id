import { errorsBase } from '../../errorsBase';

type CryptoStage = 'extension' | 'plugin' | 'csp' | 'certificate' | 'signing';

function readSourceCode(cause: unknown, message: string) {
  if (typeof cause === 'object' && cause !== null) {
    if ('code' in cause && typeof cause.code === 'string' && cause.code) {
      return cause.code;
    }
    if ('number' in cause && typeof cause.number === 'number' && cause.number) {
      return '0x' + (cause.number >>> 0).toString(16).padStart(8, '0');
    }
  }
  return (
    message.match(/\b0x[0-9a-f]{8}\b/i)?.[0] ??
    (Object.hasOwn(errorsBase, message) ? message : undefined)
  );
}

export class CryptoProError extends Error {
  readonly sourceCode?: string;
  readonly code: string;

  constructor(
    readonly stage: CryptoStage,
    code: string,
    cause?: unknown,
  ) {
    const originalMessage =
      typeof cause === 'string'
        ? cause
        : typeof cause === 'object' &&
            cause !== null &&
            'message' in cause &&
            typeof cause.message === 'string'
          ? cause.message
          : '';
    super(originalMessage || code, { cause });
    this.name = 'CryptoProError';
    this.sourceCode = readSourceCode(cause, originalMessage);
    this.code = this.sourceCode ?? code;
  }
}

export async function cryptoOperation<T>(
  stage: CryptoStage,
  code: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CryptoProError) throw error;
    throw new CryptoProError(stage, code, error);
  }
}
