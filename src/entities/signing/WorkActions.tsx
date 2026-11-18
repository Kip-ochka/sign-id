import Button from '@sber-site/malachite-kit/esm/components/Button';
import type { ScreenButtons } from '../../shared/api';
import { httpUrl } from '../../shared/lib/httpUrl';
import styles from '../../shared/ui/Screen.module.css';
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
  let secondaryAction;
  if (secondary) {
    let url: string | undefined;
    if (secondary.process === undefined && secondary.url) {
      url = httpUrl(secondary.url);
    }
    if (url && !busy) {
      secondaryAction = (
        <a
          className={styles.secondary}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {secondary.message}
        </a>
      );
    } else {
      secondaryAction = (
        <Button type="button" className={styles.secondary} disabled>
          {secondary.message}
        </Button>
      );
    }
  }
  return (
    <div className={styles.actions}>
      <Button
        type="button"
        className={styles.primary}
        disabled={busy || !onAction}
        onClick={onAction}
      >
        {buttons.accent.message}
      </Button>
      {secondaryAction}
    </div>
  );
}
