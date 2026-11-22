import { loadSettings, requestStart } from '../../entities/signing';
import type { RequestOptions } from '../../entities/signing';
import type { SettingsResponse } from '../../shared/api';

// Настройки загружаются до start, чтобы его retry использовал актуальные значения.
export async function start(options: RequestOptions, saveSettings: (settings: SettingsResponse) => void) {
    const settings = await loadSettings(options);
    options.signal.throwIfAborted();
    options.setSettings(settings);
    saveSettings(settings);
    return requestStart(options);
}
