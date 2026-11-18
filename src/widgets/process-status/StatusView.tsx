import Button from '@sber-site/malachite-kit/esm/components/Button';
import successIcon from '../../shared/assets/success.svg';
import warningIcon from '../../shared/assets/warning.svg';
import type { DisplayScreen } from '../../entities/signing';
import { canActivate } from '../../process/status';
import { ScreenCard } from '../../shared/ui/ScreenCard';
import * as css from '../../shared/ui/Screen.css';
import * as localCss from './StatusScreen.css';
const levels = {
  SUCCESS: { label: 'Успешно' },
  WARNING: { label: 'Внимание' },
  ERROR: { label: 'Ошибка' },
} as const;

export function StatusView({
  response,
  requestId,
  activate,
}: {
  response: Extract<DisplayScreen, { process: 'STATUS' }>;
  requestId?: string;
  activate: (slot: 'accent' | 'secondary') => void;
}) {
  useStyles(css);
  useStyles(localCss);
  const { title, message, level, buttons } = response.screen;
  const { label } = levels[level];
  const actions = (['accent', 'secondary'] as const).flatMap((slot) => {
    const button = buttons?.[slot];
    if (!button || !canActivate(button)) {
      return [];
    }
    return [{ slot, label: button.message }];
  });
  return (
    <ScreenCard
      title={title}
      message={message}
      indicator={
        <div className="level" data-level={level}>
          <img
            src={level === 'SUCCESS' ? successIcon : warningIcon}
            alt={label}
          />
        </div>
      }
    >
      {requestId && level !== 'SUCCESS' && (
        <p className="requestId">
          Идентификатор запроса <code>{requestId}</code>
        </p>
      )}
      {actions.length > 0 && (
        <div className="actions">
          {actions.map(({ slot, label }) => (
            <Button
              type="button"
              theme={slot === 'accent' ? 'primary' : 'secondary'}
              key={slot}
              className={slot === 'accent' ? 'primary' : 'secondary'}
              onClick={() => activate(slot)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </ScreenCard>
  );
}
