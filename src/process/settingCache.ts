import type { SettingStage } from '../screens/setting/checkWorkplace';

const storageKey = 'digital_id_sign';
const ttl = 24 * 60 * 60 * 1000;

export interface SettingCache {
  has(
    inquiryId: string,
    stages: readonly SettingStage[],
  ): boolean | Promise<boolean>;
  save(inquiryId: string, stages: readonly SettingStage[]): void;
}

export function createSettingCache(
  getDevice?: () => string | undefined,
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'> = () =>
    window.localStorage,
): SettingCache {
  return {
    has(inquiryId, stages) {
      try {
        const device = getDevice?.();
        if (!inquiryId || !device?.trim() || stages.length === 0) return false;
        const raw = getStorage().getItem(storageKey);
        if (raw === null) return false;
        const entry = JSON.parse(raw) as unknown;
        if (
          typeof entry !== 'object' ||
          entry === null ||
          !('version' in entry) ||
          !('inquiry_id' in entry) ||
          entry.inquiry_id !== inquiryId ||
          !('device' in entry) ||
          entry.device !== device ||
          !('checked_at' in entry) ||
          typeof entry.checked_at !== 'number' ||
          !Number.isSafeInteger(entry.checked_at) ||
          entry.checked_at < 0
        ) {
          return false;
        }
        const age = Date.now() - entry.checked_at;
        if (age < 0 || age >= ttl) return false;
        // Версия 1 сохранялась только после прохождения всех трёх проверок.
        if (entry.version === 1) return true;
        if (entry.version !== 2 || !('stages' in entry)) return false;
        const checkedStages = entry.stages;
        return (
          Array.isArray(checkedStages) &&
          stages.every((stage) => checkedStages.includes(stage))
        );
      } catch {
        return false;
      }
    },
    save(inquiryId, stages) {
      try {
        const device = getDevice?.();
        if (!inquiryId || !device?.trim() || stages.length === 0) return;
        getStorage().setItem(
          storageKey,
          JSON.stringify({
            version: 2,
            inquiry_id: inquiryId,
            device,
            checked_at: Date.now(),
            stages,
          }),
        );
      } catch {
        // Успех текущей проверки не зависит от записи в localStorage.
      }
    },
  };
}
