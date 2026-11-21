import Button from '@sber-site/malachite-kit/esm/components/Button';
import { Link } from '@sber-site/malachite-kit';
import type { ScreenButtons } from '../../shared/api';
import { httpUrl } from '../../shared/lib/httpUrl';
import { ActionGroup } from '../../shared/ui/ActionGroup';
export function WorkActions({
  buttons,
  busy,
  loading = false,
  onAction,
  className,
}: {
  buttons: ScreenButtons;
  busy: boolean;
  loading?: boolean;
  onAction?: () => void;
  className?: string;
}) {
  const secondary = buttons.secondary;
  const url =
    secondary?.process === undefined && secondary?.url
      ? httpUrl(secondary.url)
      : undefined;
  return (
    <ActionGroup className={className}>
      <Button
        type="button"
        theme="primary"
        size="large"
        disabled={busy || !onAction}
        loading={loading}
        onClick={onAction}
      >
        {buttons.accent.message}
      </Button>
      {secondary &&
        (url && !busy ? (
          <Link
            theme="secondary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {secondary.message}
          </Link>
        ) : (
          <Button type="button" theme="secondary" size="large" disabled>
            {secondary.message}
          </Button>
        ))}
    </ActionGroup>
  );
}
