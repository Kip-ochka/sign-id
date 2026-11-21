import { errorsBase, signingErrorOverrides } from '../errorsBase';

export function getCryptoErrorCode(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }
  if (!(error instanceof Error)) {
    return '';
  }
  if ('code' in error && typeof error.code === 'string' && error.code) {
    return error.code;
  }
  return error.message;
}

export function getCryptoErrorKey(code: string, stage: 'setup' | 'signing') {
  if (code === 'NO_CERT') {
    return code;
  }

  // HRESULT из разных адаптеров может отличаться регистром.
  const key = /^0x[0-9a-f]+$/i.test(code)
    ? '0x' + code.slice(2).toUpperCase()
    : code;
  if (
    stage === 'signing' &&
    Object.prototype.hasOwnProperty.call(signingErrorOverrides, key)
  ) {
    return signingErrorOverrides[key];
  }
  return Object.prototype.hasOwnProperty.call(errorsBase, key)
    ? (errorsBase[key] ?? undefined)
    : undefined;
}
