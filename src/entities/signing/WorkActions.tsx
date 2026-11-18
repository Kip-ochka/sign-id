import Button from '@sber-site/malachite-kit/esm/components/Button';
import type { ScreenButtons } from '../../shared/api';
import { httpUrl } from '../../shared/lib/httpUrl';
import * as css from '../../shared/ui/Screen.css';
export function WorkActions({
  buttons,
  busy,
  onAction,
}: {
  buttons: ScreenButtons;
  busy: boolean;
  onAction?: () => void;
}) {
  useStyles(css);
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
          className="secondary"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {secondary.message}
        </a>
      );
    } else {
      secondaryAction = (
        <Button type="button" className="secondary" disabled>
          {secondary.message}
        </Button>
      );
    }
  }
  return (
    <div className="actions">
      <Button
        type="button"
        className="primary"
        disabled={busy || !onAction}
        onClick={onAction}
      >
        {buttons.accent.message}
      </Button>
      {secondaryAction}
    </div>
  );
}
