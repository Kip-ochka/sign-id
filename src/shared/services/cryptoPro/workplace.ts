import { CryptoProError, cryptoOperation } from './error';

type PluginWindow = Window & {
  cadesplugin_extension_loaded_callback?: () => void;
};

let extensionResponded = false;
let pluginCheck: Promise<void> | undefined;

export async function checkBrowserPlugin() {
  // Один callback до первого обращения к cadesplugin, в том числе при одновременных проверках.
  pluginCheck ??= checkPlugin().finally(() => {
    pluginCheck = undefined;
  });
  return pluginCheck;
}

async function checkPlugin() {
  if (typeof window === 'undefined') {
    throw new CryptoProError('extension', 'BROWSER_REQUIRED');
  }

  const scope: PluginWindow = window;
  const previous = scope.cadesplugin_extension_loaded_callback;
  const callback = () => {
    extensionResponded = true;
    previous?.();
  };
  scope.cadesplugin_extension_loaded_callback = callback;

  let initialized = false;
  try {
    const { execute } = await import('crypto-pro-actual-cades-plugin');
    await execute(async ({ cadesplugin }) => {
      initialized = true;
      await cadesplugin.CreateObjectAsync('CAdESCOM.About');
    });
  } catch (cause) {
    if (extensionResponded || initialized) {
      throw new CryptoProError('plugin', 'cadesplugin_load_error', cause);
    }
    throw new CryptoProError(
      'extension',
      'cadesplugin_extension_loaded=false',
      cause,
    );
  } finally {
    if (scope.cadesplugin_extension_loaded_callback === callback) {
      scope.cadesplugin_extension_loaded_callback = previous;
    }
  }
}

/** Вызывается после успешной проверки браузера. Возвращает версию для политики Q-05. */
export async function readCspVersion() {
  return cryptoOperation('csp', 'CSP_CHECK_FAILED', async () => {
    const { execute } = await import('crypto-pro-actual-cades-plugin');
    const parts: unknown[] = await execute(async ({ cadesplugin }) => {
      const about = await cadesplugin.CreateObjectAsync('CAdESCOM.About');
      const version = await about.CSPVersion();
      return [
        await version.MajorVersion,
        await version.MinorVersion,
        await version.BuildVersion,
      ];
    });
    const [major, minor, build] = parts.map(Number);
    if (
      parts.some(
        (value) =>
          typeof value !== 'number' &&
          (typeof value !== 'string' || !/^\d+$/.test(value)),
      ) ||
      ![major, minor, build].every(Number.isSafeInteger) ||
      major <= 0 ||
      minor < 0 ||
      build < 0
    ) {
      throw new CryptoProError('csp', 'CSP_VERSION_UNAVAILABLE');
    }
    return { major, minor, build };
  });
}
