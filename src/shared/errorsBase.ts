// Код или точный текст ошибки КриптоПро → ключ экрана для getSettings.
// null означает, что в справочнике для ошибки отсутствует ключ экрана.
export const errorsBase: Readonly<Partial<Record<string, string | null>>> = {
    // Ошибки CSP
    '0x80090016': 'NTE_BAD_KEYSET',
    '0x8009000D': 'NTE_BAD_DATA',
    '0x80090008': 'NTE_BAD_ALGID',
    '0x80090014': 'NTE_BAD_PROV_TYPE',
    '0x80090017': 'NTE_BAD_SIGNATURE',
    '0x80090020': 'NTE_FAIL',
    '0x8009000B': 'NTE_BAD_KEY_STATE',
    '0x80090010': 'NTE_PERM',
    '0x80090006': 'NTE_BAD_UID',
    '0x80090019': 'NTE_KEYSET_NOT_DEF',

    // Ошибки загрузки Browser Plug-in
    plugin_load_error: 'PLUGIN_NOT_LOADED',
    'cadesplugin_extension_loaded=false': 'EXTENSION_MISSING',
    cadesplugin_load_error: 'PLUGIN_NATIVE_ERROR',
    'Extension not loaded': 'BROWSER_EXTENSION_FAILURE',
    'Promise rejected': 'PLUGIN_INIT_FAILED',

    // Ошибки создания объектов CAdESCOM
    '0x80040154': 'REGDB_E_CLASSNOTREG',
    // При подписании используйте signingErrorOverrides.
    '0x80004005': 'E_FAIL',
    '0x80070005': 'E_ACCESSDENIED',

    // Ошибки сертификатов
    '0x00000001': 'CERT_TRUST_IS_NOT_TIME_VALID',
    '0x00000004': 'CERT_TRUST_IS_REVOKED',
    '0x00000008': 'CERT_TRUST_IS_NOT_SIGNATURE_VALID',
    '0x00000020': 'CERT_TRUST_IS_UNTRUSTED_ROOT',
    '0x00000080': 'CERT_TRUST_IS_CYCLIC',
    '0x00000010': 'CERT_TRUST_IS_NOT_VALID_FOR_USAGE',
    '0x00000100': 'CERT_TRUST_INVALID_EXTENSION',
    '0x00000040': 'CERT_TRUST_REVOCATION_STATUS_UNKNOWN',

    // Ошибки подписания CAdES
    '0x80090004': 'NTE_BAD_KEY',

    // Ошибки токенов / Рутокен / JaCarta
    '0x8010006B': 'SCARD_W_CANCELLED_BY_USER',
    '0x80100069': 'SCARD_W_REMOVED_CARD',
    '0x8010002E': 'SCARD_E_NO_SMARTCARD',
    '0x80100030': 'SCARD_E_NO_READERS_AVAILABLE',

    // Ошибки лицензирования
    LICENSE_EXPIRED: 'Истекла лицензия',
    LICENSE_NOT_FOUND: 'Лицензия отсутствует',
    LICENSE_INVALID: 'Некорректная лицензия',

    // Ошибки браузерного окружения
    'Edge not supported': null,
    'Plugin not loaded': null,
    'Access denied': null,

    // Ошибки передачи данных
    CONTENT_TOO_LARGE: 'CONTENT_TOO_LARGE',
    BAD_ENCODING: 'BAD_ENCODING',
    BASE64_ERROR: 'BASE64_ERROR',
};

// Ключи, которые зависят от этапа подписания CAdES.
export const signingErrorOverrides: Readonly<Partial<Record<string, string>>> = {
    '0x80004005': 'SIGN_FAILED',
};
