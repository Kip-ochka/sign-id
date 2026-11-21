import { findCertificates } from '../../shared/services/cryptoPro/adapter';
import { CryptoProError } from '../../shared/services/cryptoPro/error';
import {
  checkBrowserPlugin,
  readCspVersion,
} from '../../shared/services/cryptoPro/workplace';

import { settingStages } from '../../entities/signing';
import type { SettingStage } from '../../entities/signing';

export async function checkCsp() {
  const csp = await readCspVersion();
  if (csp.major < 5) {
    throw new CryptoProError('csp', 'CSP_VERSION_TOO_LOW');
  }
}

export async function checkWorkplace(
  signal: AbortSignal,
  update: (stage: SettingStage, state: 'RUNNING' | 'SUCCESS') => void,
  fail: (stage: SettingStage, error: unknown) => Promise<void>,
) {
  let certificates: Awaited<ReturnType<typeof findCertificates>> | undefined;
  const completed = await settingStages.reduce(async (previous, stage) => {
    if (!(await previous)) {
      return false;
    }
    try {
      signal.throwIfAborted();
      update(stage, 'RUNNING');
      switch (stage) {
        case 'extension':
          await checkBrowserPlugin();
          break;
        case 'program':
          await checkCsp();
          break;
        case 'certificate':
          certificates = await findCertificates();
          break;
      }
      signal.throwIfAborted();
      update(stage, 'SUCCESS');
      return true;
    } catch (error) {
      if (!signal.aborted) {
        await fail(stage, error);
      }
      return false;
    }
  }, Promise.resolve(true));
  if (!completed) {
    return undefined;
  }
  return { certificates };
}
