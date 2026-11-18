import { findCertificates } from '../../shared/services/cryptoPro/adapter';
import { CryptoProError } from '../../shared/services/cryptoPro/error';
import {
  checkBrowserPlugin,
  readCspVersion,
} from '../../shared/services/cryptoPro/workplace';

export const settingStages = ['extension', 'program', 'certificate'] as const;
export type SettingStage = (typeof settingStages)[number];
export type WorkplaceResult =
  { state: 'RUNNING' | 'SUCCESS' } | { state: 'ERROR'; code: string };

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
  for (const stage of settingStages) {
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
    } catch (error) {
      if (!signal.aborted) await fail(stage, error);
      return;
    }
  }
  return { certificates };
}
