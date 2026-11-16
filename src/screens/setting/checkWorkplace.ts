import type { SettingScreen } from '../../shared/api';
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

export function getSettingStages(response: SettingScreen) {
  return settingStages.filter((stage) =>
    response.screen.lists.testing.some(({ name }) => name === stage),
  );
}

export async function checkCsp() {
  const csp = await readCspVersion();
  if (csp.major < 5) {
    throw new CryptoProError('csp', 'CSP_VERSION_TOO_LOW');
  }
}

export async function checkWorkplace(
  response: SettingScreen,
  stages: readonly SettingStage[],
  signal: AbortSignal,
  update: (stage: SettingStage, state: 'RUNNING' | 'SUCCESS') => void,
  fail: (stage: SettingStage, error: unknown) => void,
) {
  let certificates: Awaited<ReturnType<typeof findCertificates>> | undefined;
  for (const stage of stages) {
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
          certificates = await findCertificates(response.cryptopro?.filters);
          break;
      }
      signal.throwIfAborted();
      update(stage, 'SUCCESS');
    } catch (error) {
      if (!signal.aborted) fail(stage, error);
      return;
    }
  }
  return { certificates };
}
