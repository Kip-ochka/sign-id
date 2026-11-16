import type { DisplayScreen } from '../../process/model';
import { canActivate } from '../../process/useStatusActions';
import { ScreenCard } from '../shared/ScreenCard';
import styles from '../shared/Screen.module.css';
import local from './StatusScreen.module.css';
const levels = {
  SUCCESS: { label: 'Успешно', symbol: '✓' },
  WARNING: { label: 'Внимание', symbol: '!' },
  ERROR: { label: 'Ошибка', symbol: '×' },
} as const;

export function StatusScreen({
  response,
  requestId,
  activate,
}: {
  response: Extract<DisplayScreen, { process: 'STATUS' }>;
  requestId?: string;
  activate: (slot: 'accent' | 'secondary') => void;
}) {
  const { title, message, level, buttons } = response.screen;
  const { label, symbol } = levels[level];
  const actions = (['accent', 'secondary'] as const).flatMap((slot) => {
    const button = buttons?.[slot];
    return button && canActivate(button)
      ? [{ slot, label: button.message }]
      : [];
  });
  return (
    <ScreenCard
      title={title}
      message={message}
      indicator={
        <div className={local.level} data-level={level}>
          <span aria-hidden="true">{symbol}</span>
          {label}
        </div>
      }
    >
      {requestId && level !== 'SUCCESS' && (
        <p className={local.requestId}>
          Идентификатор запроса <code>{requestId}</code>
        </p>
      )}
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map(({ slot, label }) => (
            <button
              type="button"
              key={slot}
              className={slot === 'accent' ? styles.primary : styles.secondary}
              onClick={() => activate(slot)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </ScreenCard>
  );
}
