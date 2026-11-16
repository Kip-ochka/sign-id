import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { execute, getUserCertificates } from 'crypto-pro-actual-cades-plugin';

import {
  getCryptoErrorCode,
  getCryptoErrorKey,
} from '../../../process/network';
import { findCertificates, signHash } from './adapter';
import { checkBrowserPlugin, readCspVersion } from './workplace';

jest.mock('crypto-pro-actual-cades-plugin', () => ({
  execute: jest.fn(),
  getUserCertificates: jest.fn(),
}));

const pluginExecute = jest.mocked(execute);
const pluginCertificates = jest.mocked(getUserCertificates);
const windowMock = {
  cadesplugin_extension_loaded_callback: jest.fn<() => void>(),
};

const mode = {
  sign_type: 'single',
  sign_format: 'other',
  sign_position: 'detached',
};
const hashes = { hash256: 'aB'.repeat(32), hash512: 'Cd'.repeat(64) };
const input = {
  mode,
  thumbprint: 'aa',
  hashes,
  parameters: { profile: 'PKCS7' } as const,
};

function certificate(oid = '1.2.643.7.1.1.1.1') {
  return {
    _cadesCertificate: {},
    name: '',
    subjectName: String.raw`SN=Иванов + G=Иван, OID.2.5.4.43=Иванович, INN=001, O="Тест, ""ООО""", OID.1.2.643.100.4=002, SNILS=003, OGRN=004`,
    issuerName: String.raw`O=УЦ\, Тест, OID.1.2.643.100.4=005, OID.1.2.643.100.1=006`,
    thumbprint: 'AA',
    validFrom: '2020-01-01',
    validTo: '2030-01-01',
    getCadesProp: jest.fn(async () => '0123'),
    getAlgorithm: jest.fn(async () => ({ oid, algorithm: 'synthetic' })),
    exportBase64: jest.fn(async () => 'dGVz\r\ndA=='),
    getOwnerInfo: jest.fn<never>(),
    getIssuerInfo: jest.fn<never>(),
    getExtendedKeyUsage: jest.fn<never>(),
    getDecodedExtendedKeyUsage: jest.fn<never>(),
    isValid: jest.fn<never>(),
    hasExtendedKeyUsage: jest.fn<never>(),
  };
}

beforeEach(() => {
  pluginExecute.mockReset();
  pluginCertificates.mockReset();
  windowMock.cadesplugin_extension_loaded_callback = jest.fn();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: windowMock,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

describe('проверка рабочего места', () => {
  test('отказ инициализации без сигнала расширения', async () => {
    const previous = windowMock.cadesplugin_extension_loaded_callback;
    const cause = new Error('Плагин недоступен');
    pluginExecute.mockRejectedValue(cause);
    await expect(checkBrowserPlugin()).rejects.toMatchObject({
      code: 'cadesplugin_extension_loaded=false',
      stage: 'extension',
      cause,
    });
    expect(windowMock.cadesplugin_extension_loaded_callback).toBe(previous);
  });

  test('сигнал расширения сохраняет предыдущий callback и отличает отказ плагина', async () => {
    const previous = windowMock.cadesplugin_extension_loaded_callback;
    pluginExecute.mockImplementation(async () => {
      windowMock.cadesplugin_extension_loaded_callback();
      throw new Error('Нативный компонент недоступен');
    });
    const results = await Promise.allSettled([
      checkBrowserPlugin(),
      checkBrowserPlugin(),
    ]);
    expect(results).toEqual([
      {
        status: 'rejected',
        reason: expect.objectContaining({
          stage: 'plugin',
          code: 'cadesplugin_load_error',
        }),
      },
      {
        status: 'rejected',
        reason: expect.objectContaining({
          stage: 'plugin',
          code: 'cadesplugin_load_error',
        }),
      },
    ]);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(pluginExecute).toHaveBeenCalledTimes(1);
    expect(windowMock.cadesplugin_extension_loaded_callback).toBe(previous);
  });

  test('проверка браузера создаёт About, CSP отдельно сообщает номер сборки', async () => {
    const CSPVersion = jest.fn(async () => ({
      MajorVersion: 5,
      MinorVersion: '0',
      BuildVersion: 12000,
    }));
    const CreateObjectAsync = jest.fn<
      (name: string) => Promise<{ CSPVersion: typeof CSPVersion }>
    >(async () => ({ CSPVersion }));
    pluginExecute.mockImplementation((callback) =>
      callback({
        cadesplugin: { CreateObjectAsync },
      } as Parameters<typeof callback>[0]),
    );
    await checkBrowserPlugin();
    expect(CreateObjectAsync).toHaveBeenCalledWith('CAdESCOM.About');
    expect(CSPVersion).not.toHaveBeenCalled();
    await expect(readCspVersion()).resolves.toEqual({
      major: 5,
      minor: 0,
      build: 12000,
    });
  });

  test('CSP сохраняет HRESULT и причину для общего справочника', async () => {
    const cause = Object.assign(new Error('CSP недоступен (0x80090019)'), {
      number: -2146893799,
    });
    pluginExecute.mockRejectedValue(cause);
    const error: unknown = await readCspVersion().catch(
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({
      stage: 'csp',
      sourceCode: '0x80090019',
      cause,
    });
    expect(getCryptoErrorKey(getCryptoErrorCode(error), 'setup')).toBe(
      'NTE_KEYSET_NOT_DEF',
    );
  });
});

describe('поиск сертификатов', () => {
  test('разбирает поля по OID и aliases, учитывает optional-фильтры, разделяет Subject и Issuer', async () => {
    const selected = certificate();
    pluginCertificates.mockResolvedValue([selected]);
    const expected = {
      type: 'signed',
      serial_number: '0123',
      thumbprint: 'AA',
      expires_at: '2030-01-01T00:00:00.000Z',
      person: {
        last_name: 'Иванов',
        first_name: 'Иван',
        middle_name: 'Иванович',
        inn: '001',
        snils: '003',
      },
      organization: { name: 'Тест, "ООО"', inn: '002', ogrn: '004' },
      issuer: { name: 'УЦ, Тест', inn: '005', ogrn: '006' },
    };
    await expect(findCertificates()).resolves.toEqual([expected]);
    await expect(
      findCertificates({ person: {}, issuer: { inn: '005' } }),
    ).resolves.toEqual([expected]);
    await expect(
      findCertificates({ organization: { inn: '005' } }),
    ).rejects.toMatchObject({ code: 'NO_CERT' });
    expect(pluginCertificates.mock.calls).toEqual([[true], [true], [true]]);
    expect(selected.exportBase64).not.toHaveBeenCalled();
  });

  test('отсутствующее или неоднозначное поле не проходит заданный фильтр', async () => {
    const selected = certificate();
    selected.subjectName = 'G=Иван, OID.2.5.4.42=Пётр';
    pluginCertificates.mockResolvedValue([selected]);
    await expect(findCertificates()).resolves.toMatchObject([
      { person: {}, organization: {} },
    ]);
    await expect(
      findCertificates({ person: { first_name: 'Иван' } }),
    ).rejects.toMatchObject({ code: 'NO_CERT' });
    await expect(
      findCertificates({ person: { middle_name: '' } }),
    ).rejects.toMatchObject({ code: 'NO_CERT' });
  });

  test('пустой список библиотеки отличается от сбоя чтения', async () => {
    pluginCertificates.mockRejectedValueOnce(
      new Error('Нет доступных сертификатов'),
    );
    await expect(findCertificates()).rejects.toMatchObject({
      code: 'NO_CERT',
      stage: 'certificate',
    });
    pluginCertificates.mockRejectedValueOnce(new Error('Хранилище недоступно'));
    await expect(findCertificates()).rejects.toMatchObject({
      code: 'CERTIFICATE_SEARCH_FAILED',
      stage: 'certificate',
    });
  });
});

function mockSigning(base64 = 'YQ==') {
  const data = { propset_Algorithm: jest.fn(), SetHashValue: jest.fn() };
  const signer = {
    propset_Certificate: jest.fn(),
    propset_TSAAddress: jest.fn(),
  };
  const signed = {
    SignHash: jest.fn<
      (data: unknown, signer: unknown, profile: number) => string
    >(() => base64),
  };
  const objects = {
    'CAdESCOM.HashedData': data,
    'CAdESCOM.CPSigner': signer,
    'CAdESCOM.CadesSignedData': signed,
  };
  pluginExecute.mockImplementation((callback) =>
    callback({
      cadesplugin: {
        CreateObjectAsync: (name: keyof typeof objects) => objects[name],
        CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256: 101,
        CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_512: 102,
        CADESCOM_PKCS7_TYPE: 0xffff,
        CADESCOM_CADES_T: 0x5,
        CADESCOM_CADES_X_LONG_TYPE_1: 0x5d,
      },
    } as Parameters<typeof callback>[0]),
  );
  return { data, signer, signed };
}

describe('отсоединённая подпись одного готового хэша', () => {
  test.each([
    ['1.2.643.7.1.1.1.1', 101, hashes.hash256],
    ['1.2.643.7.1.1.1.2', 102, hashes.hash512],
  ])(
    'выбирает хэш по OID ключа %s и использует тот же сертификат для экспорта и подписи',
    async (oid, algorithm, hex) => {
      const selected = certificate(oid);
      pluginCertificates.mockResolvedValue([selected]);
      const { data, signer, signed } = mockSigning();
      await expect(signHash(input)).resolves.toMatchObject({
        signatureBase64: 'YQ==',
        certificate: { certificate_base64: 'dGVzdA==', thumbprint: 'AA' },
      });
      expect(data.propset_Algorithm).toHaveBeenCalledWith(algorithm);
      expect(data.SetHashValue).toHaveBeenCalledTimes(1);
      expect(data.SetHashValue).toHaveBeenCalledWith(hex);
      expect(signer.propset_Certificate).toHaveBeenCalledWith(
        selected._cadesCertificate,
      );
      expect(signed.SignHash).toHaveBeenCalledTimes(1);
      expect(signed.SignHash).toHaveBeenCalledWith(data, signer, 0xffff);
      expect(signer.propset_TSAAddress).not.toHaveBeenCalled();
    },
  );

  test('использует явный профиль CAdES-T с переданным TSA', async () => {
    pluginCertificates.mockResolvedValue([certificate()]);
    const { data, signer, signed } = mockSigning();
    await signHash({
      ...input,
      parameters: {
        profile: 'CADES_T',
        tsaAddress: 'https://tsa.example.test',
      },
    });
    expect(signer.propset_TSAAddress).toHaveBeenCalledWith(
      'https://tsa.example.test',
    );
    expect(signed.SignHash).toHaveBeenCalledWith(data, signer, 0x5);
  });

  test.each(['1.2.643.2.2.19', '1.2.643.7.1.1.3.2', '1.2.3'])(
    'отклоняет неподдерживаемый OID %s',
    async (oid) => {
      pluginCertificates.mockResolvedValue([certificate(oid)]);
      await expect(signHash(input)).rejects.toMatchObject({
        code: 'UNSUPPORTED_KEY_ALGORITHM',
      });
      expect(pluginExecute).not.toHaveBeenCalled();
    },
  );

  test('отклоняет отсутствующий 512-битный хэш при наличии 256-битного', async () => {
    pluginCertificates.mockResolvedValue([certificate('1.2.643.7.1.1.1.2')]);
    await expect(
      signHash({ ...input, hashes: { hash256: hashes.hash256 } }),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNING_HASH' });
    expect(pluginExecute).not.toHaveBeenCalled();
  });

  test.each([
    { ...mode, sign_type: 'batch' },
    { ...mode, sign_format: 'archived' },
    { ...mode, sign_format: 'xml' },
    { ...mode, sign_position: 'attached' },
  ])('отклоняет режим %j до обращения к плагину', async (mode) => {
    await expect(signHash({ ...input, mode })).rejects.toMatchObject({
      code: 'UNSUPPORTED_SIGNING_MODE',
    });
    expect(pluginCertificates).not.toHaveBeenCalled();
    expect(pluginExecute).not.toHaveBeenCalled();
  });

  test('перечитывает хранилище и фильтр перед подписью', async () => {
    pluginCertificates
      .mockResolvedValueOnce([certificate()])
      .mockResolvedValueOnce([]);
    await findCertificates();
    await expect(signHash(input)).rejects.toMatchObject({ code: 'NO_CERT' });
    pluginCertificates.mockResolvedValueOnce([certificate()]);
    await expect(
      signHash({ ...input, filters: { issuer: { inn: '002' } } }),
    ).rejects.toMatchObject({ code: 'NO_CERT' });
    expect(pluginExecute).not.toHaveBeenCalled();
  });

  test.each(['', 'YQ', 'Y$Q=', 'YR=='])(
    'отклоняет повреждённый Base64 %j',
    async (base64) => {
      pluginCertificates.mockResolvedValue([certificate()]);
      mockSigning(base64);
      await expect(signHash(input)).rejects.toMatchObject({
        stage: 'signing',
        code: 'BASE64_ERROR',
      });
    },
  );
});
