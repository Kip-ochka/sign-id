import type { ScreenButtons } from '../../shared/api';
import { httpUrl } from './httpUrl';
import styles from './Screen.module.css';
export function WorkActions({
  buttons,
  busy,
  onAction,
}: {
  buttons: ScreenButtons;
  busy: boolean;
  onAction?: () => void;
}) {
  const secondary = buttons.secondary;
  const url =
    secondary?.process === undefined && secondary?.url
      ? httpUrl(secondary.url)
      : undefined;
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.primary}
        disabled={busy || !onAction}
        onClick={onAction}
      >
        {buttons.accent.message}
      </button>
      {secondary &&
        (url && !busy ? (
          <a
            className={styles.secondary}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {secondary.message}
          </a>
        ) : (
          <button type="button" className={styles.secondary} disabled>
            {secondary.message}
          </button>
        ))}
    </div>
  );
}
